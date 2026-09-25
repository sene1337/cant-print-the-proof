// Verse 3, the halving: a stack of 50 orange coins is cut in half on the beats (50, 25, 12.5, 6.25),
// then a glass vessel etched 21,000,000 fills with molten orange, each pour half of what's left: it never reaches the brim.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { bitcoinGlyph } from '../tex.js';
import { orangeFace, coinMap, canvas, canvasTex, Motes, glowCard } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, smooth, easeOut, easeIn, easeInOut } from '../util.js';

export const HR = 0.9, HT = 0.1;   // stack coin radius and thickness
export const PLINTH = 1.0;         // plinth top
export const TANK = { w: 1.66, y0: 0.55, h: 2.44 }; // vessel inner width, inner floor, inner height
const N = 50;

function plaqueTexture(txt) {
  const c = canvas(512, 256), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffb347'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 170px "Figtree"';
  g.fillText(txt, 256, 138);
  return canvasTex(c);
}

// Molten metal: bright convection veins in a deep orange body, darker crust between.
function lavaTexture() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  const R = (i) => hash1(i * 7 + 3);
  g.fillStyle = 'rgb(150,48,6)'; g.fillRect(0, 0, S, S);
  const blob = (i, col, rmin, rmax, blur) => {
    const x = R(i) * S, y = R(i + 1) * S, r = rmin + R(i + 2) * (rmax - rmin);
    g.filter = `blur(${blur}px)`;
    g.fillStyle = col;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.beginPath(); g.ellipse(x + dx, y + dy, r, r * (0.5 + R(i + 3)), R(i + 4) * 3, 0, Math.PI * 2); g.fill(); }
  };
  for (let i = 0; i < 70; i++) blob(i * 11, 'rgba(70,14,0,0.55)', 20, 60, 10);
  for (let i = 0; i < 90; i++) blob(i * 13 + 5000, 'rgba(255,150,40,0.45)', 6, 26, 5);
  for (let i = 0; i < 60; i++) blob(i * 17 + 9000, 'rgba(255,215,120,0.5)', 2, 7, 2);
  g.filter = 'none';
  const t = canvasTex(c, { repeat: true });
  return t;
}

// Frosted etching on glass: the total, and a fine line at the brim.
function etchTexture() {
  const c = canvas(2048, 512), g = c.getContext('2d');
  g.clearRect(0, 0, 2048, 512);
  g.fillStyle = 'rgba(236,240,244,0.92)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 300px "Cormorant Garamond"';
  g.shadowColor = 'rgba(255,255,255,0.5)'; g.shadowBlur = 6;
  g.fillText('21,000,000', 1024, 300);
  g.fillRect(40, 18, 1968, 10);
  return canvasTex(c, { aniso: 16 });
}

export async function verse3HalvingStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 2.5], color: [1, 0.93, 0.85], intensity: 2.4 },
    { pos: [-6, 1.2, 2], size: [0.5, 5], color: [1, 0.75, 0.5], intensity: 3.0 },
    { pos: [6, 0.8, -1], size: [0.4, 5], color: [0.9, 0.93, 1], intensity: 2.6 },
    { pos: [0, 1.4, 7], size: [6, 3.2], color: [1, 0.9, 0.8], intensity: 1.1 },
  ], { top: [0.42, 0.38, 0.34], horizon: [0.1, 0.08, 0.06], bottom: [0.01, 0.008, 0.006] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xfff0dc, 9, 40, 0.55, 0.8, 1.2);
  key.position.set(-4, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb070, 0.9);
  rim.position.set(4, 4, -6);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- the stack
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, PLINTH, 2.6), new THREE.MeshPhysicalMaterial({ color: 0x060606, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.1 }));
  plinth.position.y = PLINTH / 2;
  plinth.castShadow = plinth.receiveShadow = true;
  scene.add(plinth);
  const plaques = ['50', '25', '12.5', '6.25'].map((txt) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: plaqueTexture(txt), color: new THREE.Color(1.5, 1.5, 1.5), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    m.position.set(0, PLINTH - 0.3, 1.302);
    scene.add(m);
    return m;
  });

  const face = orangeFace(bitcoinGlyph);
  const proto = new Coin({ radius: HR, thickness: HT, face, metal: 'orange', seed: 31 });
  proto.faceMat.roughnessMap = coinMap(face.rough, HR); proto.faceMat.roughness = 1;
  const coins = new THREE.InstancedMesh(proto.mesh.geometry, [proto.faceMat, proto.sideMat], N * 2 + 4);
  coins.castShadow = true; coins.receiveShadow = true;
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  coins.frustumCulled = false;
  scene.add(coins);
  const slash = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.5).multiplyScalar(6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(slash);
  const sparks = new Motes({ count: 300, size: 0.03, color: [1, 0.62, 0.22], gain: 7 });
  scene.add(sparks);

  // ---- the vessel: a glass tank on a black stone plinth, filled with molten orange
  const vessel = new THREE.Group();
  scene.add(vessel);
  const stone = new THREE.MeshPhysicalMaterial({ color: 0x070707, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.1 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.5, 2.5, 3, 0.03), stone);
  base.position.y = 0.25; base.castShadow = base.receiveShadow = true;
  vessel.add(base);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.05, ior: 1.5,
    specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4, side: THREE.DoubleSide,
  });
  const GW = TANK.w + 0.1, GT = 0.05, top = TANK.y0 + TANK.h;
  for (const [w, h, d, x, y, z] of [
    [GW, TANK.h + 0.05, GT, 0, (0.5 + top) / 2, GW / 2 - GT / 2], [GW, TANK.h + 0.05, GT, 0, (0.5 + top) / 2, -GW / 2 + GT / 2],
    [GT, TANK.h + 0.05, GW - 2 * GT, GW / 2 - GT / 2, (0.5 + top) / 2, 0], [GT, TANK.h + 0.05, GW - 2 * GT, -GW / 2 + GT / 2, (0.5 + top) / 2, 0],
    [GW, 0.05, GW, 0, 0.525, 0],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass);
    m.position.set(x, y, z);
    vessel.add(m);
  }
  // the glass edges catch the light
  const edgeGlass = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(GW, TANK.h + 0.05, GW)), new THREE.LineBasicMaterial({ color: new THREE.Color(0.85, 0.92, 0.95), transparent: true, opacity: 0.55 }));
  edgeGlass.position.y = (0.5 + top) / 2;
  vessel.add(edgeGlass);
  // the etching, on the outside of the front pane
  const etch = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.39), new THREE.MeshBasicMaterial({ map: etchTexture(), transparent: true, depthWrite: false }));
  etch.position.set(0, top - 0.21, GW / 2 + 0.002);
  vessel.add(etch);
  // the molten fill: a glowing body, a hotter surface
  const lava = lavaTexture();
  const melt = new THREE.Mesh(new THREE.BoxGeometry(TANK.w - 0.01, 1, TANK.w - 0.01), new THREE.MeshStandardMaterial({ color: 0x1a0500, emissive: new THREE.Color(1, 0.62, 0.42), emissiveMap: lava, emissiveIntensity: 0.95, roughness: 0.45 }));
  vessel.add(melt);
  const surfLava = lava.clone(); surfLava.repeat.set(1.3, 1.3); surfLava.needsUpdate = true;
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(TANK.w - 0.012, TANK.w - 0.012), new THREE.MeshStandardMaterial({ color: 0x2a0a00, emissive: new THREE.Color(1, 0.75, 0.5), emissiveMap: surfLava, emissiveIntensity: 1.35, roughness: 0.25 }));
  surf.rotation.x = -Math.PI / 2;
  vessel.add(surf);
  const meltLight = new THREE.PointLight(0xff7a20, 0, 9, 1.6);
  vessel.add(meltLight);
  // the pour: a falling stream of molten metal, thinner each time
  const streamLava = lava.clone(); streamLava.needsUpdate = true;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.85, 1, 24, 1, true), new THREE.MeshBasicMaterial({ map: streamLava, color: new THREE.Color(1.5, 1.15, 0.9) }));
  vessel.add(stream);
  const splash = new Motes({ count: 260, size: 0.03, color: [1, 0.6, 0.2], gain: 6 });
  vessel.add(splash);

  const dummy = new THREE.Object3D();
  const jit = (j, k) => (hash1(j * 7 + k) - 0.5);

  const S = {
    scene, key, rim, floor, plinth, plaques, coins, slash, sparks, vessel, melt, surf, stream, etch,
    fx: { bloom: 0.45, threshold: 1.0, bloomRadius: 0.4, grain: 0.04, vignette: 0.5, tint: [1.02, 0.99, 0.95] },
    update(ctx) {
      plinth.visible = true;
      for (const p of plaques) p.visible = false;
      coins.visible = true; coins.count = 0;
      slash.visible = false; sparks.visible = false;
      vessel.visible = false;
      key.position.set(-4, 9, 6); key.target.position.set(0, 2, 0); key.intensity = 9;
      scene.environmentIntensity = 1.0;
    },

    // cuts: song times of the three cuts. Returns the current stack height in world units (for the camera).
    stack(t, cuts) {
      const heights = [N, N / 2, N / 4, N / 8];
      let stage = 0, shown = 0;
      for (const c of cuts) { if (t >= c) stage++; if (t >= c + 0.12) shown++; }
      plaques[shown].visible = true;
      const h = heights[stage];
      let n = 0;
      const put = (y, j, sc, extra) => {
        dummy.position.set(jit(j, 1) * 0.05, y, jit(j, 2) * 0.05);
        dummy.rotation.set(-Math.PI / 2, 0, jit(j, 3) * 2);
        dummy.scale.set(1, 1, sc);
        if (extra) extra(dummy);
        dummy.updateMatrix();
        coins.setMatrixAt(n++, dummy.matrix);
      };
      // standing part: whole coins, then a sliver of the one that was cut
      const whole = Math.floor(h + 1e-6), frac = h - whole;
      for (let j = 0; j < whole; j++) put(PLINTH + HT * (j + 0.5), j, 1);
      if (frac > 1e-3) put(PLINTH + HT * (whole + frac / 2), whole, frac);
      // the half just cut off: slides and tips off the right edge, then falls
      if (stage > 0) {
        const tc = cuts[stage - 1], dt = t - tc;
        const hPrev = heights[stage - 1];
        if (dt < 1.4) {
          const yCut = PLINTH + HT * h;
          const tip = easeIn(clamp(dt / 0.5), 2) * 1.4;
          const slide = dt * 1.2 + 2.2 * dt * dt;
          const fall = Math.max(0, dt - 0.25);
          const piv = new THREE.Vector3(HR * 0.9, yCut, 0);
          const tf = (d) => {
            // rotate about the pivot (z axis, clockwise), then slide right and fall
            const p = d.position.clone().sub(piv);
            p.applyAxisAngle(new THREE.Vector3(0, 0, 1), -tip);
            d.position.copy(p.add(piv)).add(new THREE.Vector3(slide, -4.9 * fall * fall, 0));
            d.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -tip);
          };
          const w0 = Math.floor(h + 1e-6), f0 = h - w0;
          if (f0 > 1e-3) put(yCut + HT * (1 - f0) / 2, w0, 1 - f0, tf);
          for (let j = Math.ceil(h - 1e-6); j < Math.ceil(hPrev - 1e-6); j++) {
            const top = Math.min(hPrev, j + 1), sc = top - j;
            put(PLINTH + HT * (j + sc / 2), j, sc, tf);
          }
        }
        // the blade's flash across the cut, and sparks
        const f = dt / 0.12;
        if (f >= 0 && f < 1) {
          slash.visible = true;
          slash.position.set(lerp(-1.8, 1.8, f), PLINTH + HT * h, 0.02);
          slash.scale.set(2.2 * Math.sin(f * Math.PI) + 0.2, 1, 1);
          slash.material.opacity = Math.sin(f * Math.PI);
        }
        sparks.burst(dt, [HR, PLINTH + HT * h, 0.2], { power: 0.7, spread: 1.4, up: 0.3, dir: [0.5, 0, 0.2], life: 0.6, gravity: 6, seed: stage * 5 });
      }
      coins.count = n;
      coins.instanceMatrix.needsUpdate = true;
      return HT * h;
    },

    // pours: song times each pour starts. Pour k fills half of what is left, so the level runs 1/2, 3/4, 7/8...
    vesselAt(t, pours) {
      plinth.visible = false;
      coins.visible = false;
      vessel.visible = true;
      key.position.set(-3.5, 8, 5); key.target.position.set(0, 1.4, 0); key.intensity = 7;
      scene.environmentIntensity = 0.8;
      let level = 0, active = -1;
      pours.forEach((tp, k) => {
        const dur = Math.max(0.09, 0.3 * Math.pow(0.8, k));
        const f = clamp((t - tp) / dur);
        const before = 1 - Math.pow(0.5, k), after = 1 - Math.pow(0.5, k + 1);
        if (t >= tp) { level = lerp(before, after, easeOut(f, 2)); if (f < 1) active = k; }
      });
      const hLvl = Math.max(0.002, level * TANK.h);
      melt.visible = level > 0;
      melt.scale.set(1, hLvl, 1);
      lava.repeat.set(1, hLvl / TANK.w); // keep the molten pattern from stretching as the level rises
      melt.position.y = TANK.y0 + hLvl / 2;
      surf.visible = level > 0;
      surf.position.y = TANK.y0 + hLvl + 0.001;
      meltLight.position.set(0, TANK.y0 + hLvl + 0.3, 0.3);
      meltLight.intensity = 4 * Math.sqrt(level);
      surfLava.offset.set(t * 0.02, t * 0.013);
      stream.visible = active >= 0;
      if (active >= 0) {
        const r = 0.11 * Math.sqrt(Math.pow(0.5, active));
        const yTop = 7, yBot = TANK.y0 + hLvl;
        stream.scale.set(r, yTop - yBot, r);
        streamLava.repeat.set(0.25, (yTop - yBot) * 0.8);
        streamLava.offset.set(0, t * 3.5); // the metal pours downward
        stream.position.set(Math.sin(t * 9) * 0.01, (yTop + yBot) / 2, 0.1);
      }
      const lastStart = pours.filter((tp) => tp <= t).pop();
      const k = pours.indexOf(lastStart);
      splash.visible = lastStart !== undefined;
      if (splash.visible) splash.burst(t - lastStart, [0, TANK.y0 + hLvl, 0.1], { power: 0.5 * Math.pow(0.8, k), spread: 0.6, up: 1.0, life: 0.5, gravity: 5, seed: 20 + k });
    },
  };
  return S;
}
