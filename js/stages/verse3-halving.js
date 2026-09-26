// Verse 3, the halving: a stack of 50 orange coins is cut in half four times (50, 25, 12.5, 6.25, 3.125: today's reward),
// then a glass vessel etched 21,000,000 fills with molten orange, each pour half of what's left: it never reaches the brim.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { bitcoinGlyph, normalFromHeight } from '../tex.js';
import { orangeFace, coinMap, canvas, canvasTex, Motes, glowCard } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, smooth, easeOut, easeIn, easeInOut } from '../util.js';

export const HR = 0.9, HT = 0.1;   // stack coin radius and thickness
export const PLINTH = 1.0;         // plinth top
export const TANK = { w: 1.66, y0: 0.55, h: 2.44 }; // vessel inner width, inner floor, inner height
const N = 50;

// The number on the plinth. One font size for every value, chosen so the longest ("3.125") fits.
const PLAQUE_W = 1024, PLAQUE_H = 360;
function plaqueTexture(txt) {
  const c = canvas(PLAQUE_W, PLAQUE_H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, PLAQUE_W, PLAQUE_H);
  g.fillStyle = '#ffb347'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let px = 250;
  g.font = `800 ${px}px "Figtree"`;
  const wMax = g.measureText('3.125').width;
  if (wMax > PLAQUE_W * 0.9) px = Math.floor(px * (PLAQUE_W * 0.9) / wMax);
  g.font = `800 ${px}px "Figtree"`;
  g.fillText(txt, PLAQUE_W / 2, PLAQUE_H * 0.54);
  return canvasTex(c);
}

// Molten metal: a smooth heat gradient (hottest at the top) for the body, and slow gentle ripples for the surface.
function heatTexture() {
  const c = canvas(8, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, 'rgb(150,58,14)'); gr.addColorStop(0.6, 'rgb(225,120,38)'); gr.addColorStop(1, 'rgb(255,196,96)');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  return canvasTex(c, { mips: false });
}
// The skin of molten metal: smooth, hottest where the pour lands, a little cooler toward the walls.
function heatSkin() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.75);
  gr.addColorStop(0, 'rgb(255,236,196)'); gr.addColorStop(0.45, 'rgb(255,200,120)'); gr.addColorStop(1, 'rgb(226,128,44)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return canvasTex(c, { mips: false });
}

// One slow, broad swell across the surface (no fine pattern): enough to make the highlight glide.
function rippleNormal() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x / S) * Math.PI * 2, v = (y / S) * Math.PI * 2;
    const hgt = 0.5 + 0.25 * Math.sin(u + 0.6 * v) + 0.15 * Math.sin(v - 0.4 * u);
    const k = Math.round(255 * hgt);
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = normalFromHeight(c, 6, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
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
    { pos: [0, 6, 2], size: [6, 2.5], color: [1, 0.97, 0.94], intensity: 2.4 },
    { pos: [-6, 1.2, 2], size: [0.5, 5], color: [1, 0.95, 0.9], intensity: 2.6 },
    { pos: [6, 0.8, -1], size: [0.4, 5], color: [0.92, 0.95, 1], intensity: 2.4 },
    { pos: [0, 1.4, 7], size: [6, 3.2], color: [1, 0.96, 0.92], intensity: 1.1 },
    { pos: [0, 2.2, -6], size: [7, 1.6], color: [1, 0.95, 0.88], intensity: 0.9 },
  ], { top: [0.4, 0.39, 0.38], horizon: [0.1, 0.095, 0.09], bottom: [0.01, 0.01, 0.01] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xfff0dc, 9, 40, 0.55, 0.8, 1.2);
  key.position.set(-4, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffe6cc, 0.8);
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
  const plaques = ['50', '25', '12.5', '6.25', '3.125'].map((txt) => {
    const pw = 1.4, ph = pw * PLAQUE_H / PLAQUE_W;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: plaqueTexture(txt), color: new THREE.Color(1.5, 1.5, 1.5), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    m.position.set(0, PLINTH - 0.3, 1.302);
    scene.add(m);
    return m;
  });

  const face = orangeFace(bitcoinGlyph);
  const proto = new Coin({ radius: HR, thickness: HT, face, metal: 'orange', seed: 31 });
  proto.faceMat.roughnessMap = coinMap(face.rough, HR); proto.faceMat.roughness = 1;
  proto.sideMat.roughness = 0.5;
  const coins = new THREE.InstancedMesh(proto.mesh.geometry, [proto.faceMat, proto.sideMat], N * 2 + 4);
  coins.castShadow = true; coins.receiveShadow = true;
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  coins.frustumCulled = false;
  scene.add(coins);
  const fallMats = [proto.faceMat.clone(), proto.sideMat.clone()];
  for (const m of fallMats) { m.transparent = true; m.depthWrite = false; }
  const fallers = new THREE.InstancedMesh(proto.mesh.geometry, fallMats, N + 2);
  fallers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fallers.frustumCulled = false;
  scene.add(fallers);
  const slash = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(slash);
  const sparks = new Motes({ count: 70, size: 0.026, color: [1, 0.75, 0.4], gain: 3 });
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
  // a glossy molten metal: bright gold-orange, mirror-smooth, glowing hottest at the top
  const heat = heatTexture();
  const melt = new THREE.Mesh(new THREE.BoxGeometry(TANK.w - 0.01, 1, TANK.w - 0.01), new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.62, 0.22), metalness: 1, roughness: 0.2, emissive: new THREE.Color(1, 0.62, 0.3), emissiveMap: heat, emissiveIntensity: 0.85,
  }));
  vessel.add(melt);
  const ripple = rippleNormal();
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(TANK.w - 0.012, TANK.w - 0.012), new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.74, 0.38), metalness: 1, roughness: 0.2, emissive: new THREE.Color(1, 1, 1), emissiveMap: heatSkin(), emissiveIntensity: 0.5,
    normalMap: ripple, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.9,
  }));
  surf.rotation.x = -Math.PI / 2;
  vessel.add(surf);
  const meltLight = new THREE.PointLight(0xffa040, 0, 9, 1.6);
  meltLight.decay = 2;
  vessel.add(meltLight);
  // one continuous pour, thinning as the space left halves
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.9, 1, 32, 1, true), new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.66, 0.26), metalness: 1, roughness: 0.12, emissive: new THREE.Color(1, 0.6, 0.24), emissiveIntensity: 0.62,
  }));
  vessel.add(stream);
  const splash = new Motes({ count: 40, size: 0.022, color: [1, 0.75, 0.45], gain: 1.6 });
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
      fallers.visible = false; fallers.count = 0;
      slash.visible = false; sparks.visible = false;
      vessel.visible = false;
      key.position.set(-4, 9, 6); key.target.position.set(0, 2, 0); key.intensity = 9;
      scene.environmentIntensity = 1.0;
    },

    // cuts: song times of the four cuts (50 -> 25 -> 12.5 -> 6.25 -> 3.125). Returns the stack height in world units.
    stack(t, cuts) {
      const heights = [N, N / 2, N / 4, N / 8, N / 16];
      let stage = 0;
      for (const c of cuts) if (t >= c) stage++;
      // the number on the plinth dips out on the slash and the new one comes up right after it (never both at once);
      // quick, so every value gets as long as possible to be read
      plaques.forEach((p, i) => {
        const on = i === 0 ? 1 : smooth(clamp((t - cuts[i - 1] - 0.05) / 0.08));
        const off = i + 1 < plaques.length && i < cuts.length ? smooth(clamp((t - cuts[i]) / 0.06)) : 0;
        const a = on * (1 - off);
        p.visible = a > 0.001;
        p.material.opacity = a;
      });
      const h = heights[stage];
      let n = 0, nf = 0;
      const put = (y, j, sc, extra) => {
        dummy.position.set(jit(j, 1) * 0.05, y, jit(j, 2) * 0.05);
        dummy.rotation.set(-Math.PI / 2, 0, jit(j, 3) * 2);
        dummy.scale.set(1, 1, sc);
        if (extra) extra(dummy);
        dummy.updateMatrix();
        if (extra) fallers.setMatrixAt(nf++, dummy.matrix); else coins.setMatrixAt(n++, dummy.matrix);
      };
      // standing part: whole coins, then a sliver of the one that was cut
      const whole = Math.floor(h + 1e-6), frac = h - whole;
      for (let j = 0; j < whole; j++) put(PLINTH + HT * (j + 0.5), j, 1);
      if (frac > 1e-3) put(PLINTH + HT * (whole + frac / 2), whole, frac);
      // the half just cut off
      if (stage > 0) {
        const tc = cuts[stage - 1], dt = t - tc;
        const hPrev = heights[stage - 1];
        if (dt < 0.4) {
          // the half that was cut off lifts a hair and dissolves (no sliding stripes)
          const fade = 1 - smooth(clamp(dt / 0.35));
          for (const m of fallMats) m.opacity = fade;
          fallers.visible = true;
          const lift = 0.12 * smooth(clamp(dt / 0.35));
          const tf = (d) => { d.position.y += lift; };
          const w0 = Math.floor(h + 1e-6), f0 = h - w0;
          if (f0 > 1e-3) put(PLINTH + HT * h + HT * (1 - f0) / 2, w0, 1 - f0, tf);
          for (let j = Math.ceil(h - 1e-6); j < Math.ceil(hPrev - 1e-6); j++) {
            const top = Math.min(hPrev, j + 1), sc = top - j;
            put(PLINTH + HT * (j + sc / 2), j, sc, tf);
          }
        }
        // the blade's flash across the cut, and sparks
        const f = dt / 0.22;
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
      fallers.count = nf;
      fallers.instanceMatrix.needsUpdate = true;
      return HT * h;
    },

    // pours: song times each pour starts. Pour k fills half of what is left, so the level runs 1/2, 3/4, 7/8...
    vesselAt(t, pours) {
      plinth.visible = false;
      coins.visible = false;
      vessel.visible = true;
      key.position.set(-3.5, 8, 5); key.target.position.set(0, 1.4, 0); key.intensity = 7;
      scene.environmentIntensity = 0.8;
      // x counts the halvings done so far, as a smooth number; the level is 1 - 1/2^x
      let x = 0;
      pours.forEach((tp, k) => { x += easeOut(clamp((t - tp) / Math.max(0.12, 0.34 * Math.pow(0.82, k))), 2); });
      const level = x > 0 ? 1 - Math.pow(0.5, x) : 0;
      const hLvl = Math.max(0.002, level * TANK.h);
      melt.visible = level > 0;
      melt.scale.set(1, hLvl, 1);
      melt.position.y = TANK.y0 + hLvl / 2;
      surf.visible = level > 0;
      surf.position.y = TANK.y0 + hLvl + 0.001;
      ripple.offset.set(t * 0.06, t * 0.035); // one broad swell drifting slowly across
      meltLight.position.set(0, TANK.y0 + hLvl + 0.3, 0.3);
      meltLight.intensity = 3 * Math.sqrt(level);
      // the stream: arrives just before the first pour, thins with every halving, tapers away after the last
      const p0 = pours[0], pN = pours[pours.length - 1];
      const arrive = smooth(clamp((t - (p0 - 0.16)) / 0.16));
      const leave = 1 - smooth(clamp((t - (pN + 0.2)) / 0.3));
      const r = 0.1 * Math.pow(0.5, x / 2) * leave;
      stream.visible = arrive > 0 && r > 0.001;
      if (stream.visible) {
        const yTop = 7, yBot = TANK.y0 + hLvl;
        const yHead = lerp(yTop, yBot, arrive);
        stream.scale.set(r, yTop - yHead, r);
        stream.position.set(Math.sin(t * 2.2) * 0.006, (yTop + yHead) / 2, 0.1);
      }
      // a few embers lift slowly off the pour point while it flows
      splash.visible = stream.visible && arrive > 0.99;
      if (splash.visible) {
        splash.layout((i, o) => {
          const h1 = hash1(i * 7 + 1), life = 0.9;
          const age = ((t * 0.9 + h1 * life) % life);
          o[0] = (hash1(i * 7 + 2) - 0.5) * 0.25 + Math.sin(age * 3 + i) * 0.03;
          o[1] = TANK.y0 + hLvl + age * 0.5;
          o[2] = 0.1 + (hash1(i * 7 + 3) - 0.5) * 0.2;
          return Math.sin((age / life) * Math.PI) * 0.8 * leave;
        });
      }
    },
  };
  return S;
}
