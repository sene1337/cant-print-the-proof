// Verse 3, the halving: a stack of 50 orange coins is cut in half on the beats (50, 25, 12.5, 6.25),
// then a tray of 21,000,000 fills with halves that never reach its edge.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { bitcoinGlyph } from '../tex.js';
import { orangeFace, coinMap, canvas, canvasTex, Motes, glowCard } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, smooth, easeOut, easeIn, easeInOut } from '../util.js';

export const HR = 0.9, HT = 0.1;   // stack coin radius and thickness
export const PLINTH = 1.0;         // plinth top
export const TRAY = 4.0;           // tray inner size
const N = 50;

function plaqueTexture(txt) {
  const c = canvas(512, 256), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffb347'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 170px "Figtree"';
  g.fillText(txt, 256, 138);
  return canvasTex(c);
}

let BLANK = null;
function tileTexture(txt) {
  if (!txt && BLANK) return BLANK;
  const c = canvas(txt ? 512 : 16, txt ? 512 : 16), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 512);
  if (txt) {
    g.fillStyle = '#6a6a6a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${txt.length > 3 ? 150 : 210}px "Figtree"`;
    g.fillText(txt, 256, 270);
  }
  const t = canvasTex(c);
  if (!txt) BLANK = t;
  return t;
}

function rimText() {
  const c = canvas(2048, 384), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 384);
  g.fillStyle = '#ffb347'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 300px "Cormorant Garamond"';
  g.fillText('21,000,000', 1024, 200);
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

  // ---- the tray
  const tray = new THREE.Group();
  scene.add(tray);
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x151515, metalness: 0.9, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(TRAY + 0.5, 0.12, TRAY + 0.5), steel);
  base.position.y = 0.06; base.receiveShadow = true;
  tray.add(base);
  const wallH = 0.32, wallT = 0.25;
  const walls = [
    [TRAY + 0.5, wallT, 0, -(TRAY + wallT) / 2], [TRAY + 0.5, wallT, 0, (TRAY + wallT) / 2],
    [wallT, TRAY, -(TRAY + wallT) / 2, 0], [wallT, TRAY, (TRAY + wallT) / 2, 0],
  ].map(([w, d, x, z]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), steel); m.position.set(x, 0.12 + wallH / 2, z); m.castShadow = m.receiveShadow = true; tray.add(m); return m; });
  // the inner edge glows: the limit
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.1).multiplyScalar(1.5) });
  const edgeLines = [[TRAY, 0.02, 0, -TRAY / 2], [TRAY, 0.02, 0, TRAY / 2], [0.02, TRAY, -TRAY / 2, 0], [0.02, TRAY, TRAY / 2, 0]].map(([w, d, x, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.02, d + 0.02), edgeMat); m.position.set(x, 0.12 + wallH + 0.001, z); tray.add(m); return m;
  });
  // A wide ledge along the front carries the total, engraved large and lit, facing up at the camera.
  const LEDGE_D = 1.05;
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(TRAY + 0.5, 0.26, LEDGE_D), steel);
  ledge.position.set(0, 0.13, TRAY / 2 + wallT + LEDGE_D / 2);
  ledge.castShadow = ledge.receiveShadow = true;
  tray.add(ledge);
  const rimLabel = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.9 * 384 / 2048), new THREE.MeshBasicMaterial({ map: rimText(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
  rimLabel.rotation.x = -Math.PI / 2;
  rimLabel.position.set(0, 0.262, TRAY / 2 + wallT + LEDGE_D / 2);
  tray.add(rimLabel);

  // Tiles: halve what is left, alternating direction, toward the front-right corner.
  const tileGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
  const LABELS = ['50', '25', '12.5', '6.25', '3.125'];
  const tiles = [];
  {
    let x0 = -TRAY / 2, x1 = TRAY / 2, z0 = -TRAY / 2, z1 = TRAY / 2;
    for (let i = 0; i < 16; i++) {
      let r;
      if (i % 2 === 0) { const xm = (x0 + x1) / 2; r = [x0, xm, z0, z1]; x0 = xm; } else { const zm = (z0 + z1) / 2; r = [x0, x1, z0, zm]; z0 = zm; }
      const shade = 1 - i * 0.045;
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setRGB(0.97, 0.33 + i * 0.02, 0.03 + i * 0.008).multiplyScalar(Math.max(0.55, shade)),
        metalness: 1, roughness: 0.5, map: tileTexture(LABELS[i]),
      });
      const m = new THREE.Mesh(tileGeo, mat);
      m.castShadow = m.receiveShadow = true;
      tray.add(m);
      const gap = Math.min(0.03, (r[1] - r[0]) * 0.04);
      tiles.push({ m, mat, cx: (r[0] + r[1]) / 2, cz: (r[2] + r[3]) / 2, w: r[1] - r[0] - gap, d: r[3] - r[2] - gap });
    }
  }
  const dust = new Motes({ count: 200, size: 0.025, color: [1, 0.7, 0.35], gain: 4 });
  tray.add(dust);

  const dummy = new THREE.Object3D();
  const jit = (j, k) => (hash1(j * 7 + k) - 0.5);

  const S = {
    scene, key, rim, floor, plinth, plaques, coins, slash, sparks, tray, tiles, edgeLines, rimLabel,
    fx: { bloom: 0.45, threshold: 1.0, bloomRadius: 0.4, grain: 0.04, vignette: 0.5, tint: [1.02, 0.99, 0.95] },
    update(ctx) {
      plinth.visible = true;
      for (const p of plaques) p.visible = false;
      coins.visible = true; coins.count = 0;
      slash.visible = false; sparks.visible = false;
      tray.visible = false;
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

    // drops: song times each tile lands.
    trayAt(t, drops) {
      plinth.visible = false;
      coins.visible = false;
      tray.visible = true;
      key.position.set(-3, 9, 5); key.target.position.set(0.8, 0, 0.8);
      let last = -1;
      tiles.forEach((tl, i) => {
        const td = drops[i];
        const dt = td === undefined ? -1 : t - td;
        tl.m.visible = dt > -0.22;
        if (!tl.m.visible) return;
        const fall = dt < 0 ? easeIn(clamp(1 + dt / 0.22), 2) : 1;
        const bounce = dt > 0 ? Math.abs(Math.sin(dt * 30)) * Math.exp(-dt * 12) * 0.05 : 0;
        const th = Math.min(0.14, 0.3 * Math.sqrt(tl.w * tl.d));
        tl.m.scale.set(tl.w, th, tl.d);
        tl.m.position.set(tl.cx, 0.12 + th / 2 + (1 - fall) * 1.6 + bounce, tl.cz);
        tl.mat.emissive = tl.mat.emissive || new THREE.Color();
        tl.mat.emissive.setRGB(1, 0.45, 0.08);
        tl.mat.emissiveIntensity = dt > 0 ? 0.35 * Math.exp(-dt * 6) : 0;
        if (dt >= 0) last = i;
      });
      const lt = last >= 0 ? drops[last] : -9;
      const tl = tiles[Math.max(0, last)];
      dust.burst(t - lt, [tl.cx, 0.2, tl.cz], { power: 0.25 * Math.sqrt(tl.w * tl.d), spread: 0.4, up: 0.8, life: 0.5, gravity: 2, seed: last + 9 });
      edgeMat.color.set(1, 0.5, 0.1).multiplyScalar(1.0 + 0.6 * Math.exp(-(t - lt) * 5));
      scene.environmentIntensity = 0.4;
      key.intensity = 4.5;
    },
  };
  return S;
}
