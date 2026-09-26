// VERSE 1 mint stage: a copy of the shared gold studio (same coin, blank, floor and sparks) whose die carries
// the king's portrait cut into its face in mirror relief, so we can see what is about to be struck.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Coin, METALS } from '../props/coin.js';
import { Dust } from '../props/dust.js';
import { coinFace, edgeText, normalFromHeight, loadImage, TEX } from '../tex.js';
import { clamp, hash1, rng } from '../util.js';
import { wornSteel, forgedIron, leatherWrap } from '../props/verse1-metal.js';

// The die face: the stater relief inverted (sunk into the steel) and mirrored, like a real coin die.
async function dieFaceTextures({ size = 2048 } = {}) {
  const hIm = await loadImage(`${TEX.base}tex/stater_height.png`);
  const pIm = await loadImage(`${TEX.base}tex/stater_photo.jpg`);
  const cIm = await loadImage(`${TEX.base}tex/stater_cavity.png`);
  const R = size / 2;
  const S = size * 1.1; // the coin's own edge falls just outside the die face: the die's edge is the only rim
  // Draw a coin map mirrored left-right (a die is the coin's mirror image).
  const mirrored = (im, filter, bg) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.save();
    g.translate(size, 0); g.scale(-1, 1);
    g.filter = filter;
    g.drawImage(im, R - S / 2, R - S / 2, S, S);
    g.restore();
    return c;
  };
  // Colour: the museum photograph of the struck coin carries the crisp detail of real struck metal;
  // its crevices are deepened with the cavity map.
  const col = document.createElement('canvas');
  col.width = col.height = size;
  const cg = col.getContext('2d');
  cg.drawImage(mirrored(pIm, 'grayscale(1) contrast(1.25) brightness(1.02)', '#9a9a9a'), 0, 0);
  cg.globalCompositeOperation = 'multiply';
  cg.drawImage(mirrored(cIm, 'grayscale(1) contrast(1.8) brightness(1.08)', '#ffffff'), 0, 0);
  cg.globalCompositeOperation = 'source-over';
  const color = new THREE.CanvasTexture(col);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;
  // A light relief from the same image, oriented so its shading agrees with the photograph's.
  const hgt = mirrored(hIm, 'blur(2px)', '#6a6a6a');
  const normal = normalFromHeight(hgt, 1.1, 1);
  return { normal, color };
}

export async function mintStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 1.5], size: [6, 2.5], color: [1, 0.9, 0.78], intensity: 2.2 },
    { pos: [-6, 1.2, 2], size: [0.5, 5], color: [1, 0.82, 0.62], intensity: 3.0 },
    { pos: [6, 0.8, -1], size: [0.4, 5], color: [1, 0.92, 0.8], intensity: 2.4 },
    { pos: [0, 0.4, -6], size: [7, 0.3], color: [1, 0.62, 0.3], intensity: 2.0 },
    // a warm bounce card low on the floor, so the die's face has something to reflect
    { pos: [2.5, -4, 3], size: [4, 3], color: [1, 0.75, 0.45], intensity: 1.6 },
  ], { top: [0.55, 0.47, 0.38], horizon: [0.12, 0.09, 0.06], bottom: [0.05, 0.035, 0.022] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xffe2b0, 9, 30, 0.6, 1.0, 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb86b, 2.5);
  rim.position.set(3, 2, -5);
  scene.add(rim);
  // a low raking light for the die's face
  const rake = new THREE.SpotLight(0xffd9a8, 0, 20, 0.5, 0.6, 1.2);
  scene.add(rake, rake.target);

  const face = await coinFace('stater');
  const blank = await coinFace('stater', { blank: true });
  const coin = new Coin({ radius: 1, thickness: 0.16, face, metal: 'gold', edge: edgeText("CAN'T PRINT THE PROOF"), seed: 11 });
  scene.add(coin);
  const blankCoin = new Coin({ radius: 1, thickness: 0.16, face: blank, metal: 'gold', seed: 12 });
  scene.add(blankCoin);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.45, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.32, envMapIntensity: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The die: a steel punch; its bottom face carries the king in mirror relief.
  const die = new THREE.Group();
  // forged iron body with hammer marks, tapering up; a polished steel working end with a worn, bright chamfer
  const steel = wornSteel({ repeat: [3, 1] });
  steel.envMapIntensity = 1.4;
  const iron = forgedIron({ repeat: [3, 1.5] });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.03, 1.9, 96, 1, true), iron);
  body.position.y = 0.25;
  body.castShadow = true;
  die.add(body);
  const collarPts = [[1.0, -1.2], [1.05, -1.17], [1.08, -1.1], [1.08, -0.72], [1.03, -0.7]].map(([r, y]) => new THREE.Vector2(r, y));
  const collar = new THREE.Mesh(new THREE.LatheGeometry(collarPts, 96), steel);
  collar.castShadow = true;
  die.add(collar);

  const dt = await dieFaceTextures();
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6e9ec, metalness: 0.55, roughness: 0.34, map: dt.color, normalMap: dt.normal, normalScale: new THREE.Vector2(0.9, 0.9),
  });
  const dieFace = new THREE.Mesh(new THREE.CircleGeometry(1.0, 128), faceMat);
  dieFace.rotation.x = Math.PI / 2; // faces down
  dieFace.position.y = -1.2;
  die.add(dieFace);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.92, 64), iron);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 1.2;
  die.add(top);
  scene.add(die);

  // Sparks from a strike (as in the gold stage).
  const NS = 400;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    size: 0.035, color: new THREE.Color(1, 0.6, 0.2).multiplyScalar(6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sparks.frustumCulled = false;
  scene.add(sparks);

  const dust = new Dust({ count: 500, size: 0.009, box: [9, 6, 9], gain: 0.7 });
  scene.add(dust);

  // The war: the king's coins melt into a sword. A row of struck coins lies on the table; a molten front runs
  // from the guard along the blade, and each coin it reaches glows, slumps and flows into the blade.
  // Sword frame: its axis is +X from the guard (x = 0) to the tip; it lies flat (blade width along z, thickness y).
  const war = new THREE.Group();
  scene.add(war);
  const BL = 4.2, BWD = 0.3, BTH = 0.1;
  const halfW = (x) => { const u = x / BL; return BWD * (1 - 0.3 * u) * (u > 0.82 ? Math.sqrt(Math.max(0, (1 - u) / 0.18)) : 1); };
  const bladeGeo = (() => {
    const NB = 120, pos = [], idx = [], uv = [];
    // diamond section with a raised ridge down the middle: (z, y) = (-hw, 0), (0, t), (hw, 0), (0, -t)
    for (let i = 0; i <= NB; i++) {
      const x = (BL * i) / NB, hw = Math.max(halfW(x), 0.002), t = BTH * Math.min(1, hw / BWD + 0.25);
      pos.push(x, 0, -hw, x, t, 0, x, 0, hw, x, -t, 0);
      uv.push(x / BL, 0, x / BL, 0.25, x / BL, 0.5, x / BL, 0.75);
    }
    for (let i = 0; i < NB; i++) {
      for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + ((k + 1) % 4), d = (i + 1) * 4 + k;
        idx.push(a, d, b, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g.toNonIndexed();
  })();
  bladeGeo.computeVertexNormals();
  const warU = { uFront: { value: 0 }, uHot: { value: 1 } };
  // Polished metal reads by its reflections: its own studio of thin light strips on black.
  // (From the war shot's camera, the blade's near bevel mirrors the ceiling just behind the zenith, and its far
  // bevel mirrors the far horizon: a long overhead box and a warm horizon strip sit exactly there.)
  const stripEnv = studioEnv(film.renderer, [
    { pos: [0, 6, -1.4], size: [14, 2.2], color: [1, 0.88, 0.7], intensity: 0.6 },
    { pos: [0, 0.45, -6], size: [14, 0.9], color: [1, 0.5, 0.22], intensity: 0.35 },
    { pos: [-4, 4, 5], size: [0.35, 9], color: [1, 0.92, 0.8], intensity: 0.8 },
  ], { top: [0.05, 0.035, 0.025], horizon: [0.02, 0.012, 0.008], bottom: [0.004, 0.003, 0.002] });
  const bladeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setRGB(...METALS.gold.color), metalness: 1, roughness: 0.12, side: THREE.DoubleSide,
    envMap: stripEnv, envMapIntensity: 1.5,
  });

  bladeMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, warU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vBX;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBX = position.x;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBX;\nuniform float uFront, uHot;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vBX > uFront) discard;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float heat = smoothstep(uFront - 1.0, uFront, vBX);
        totalEmissiveRadiance += mix(vec3(0.8, 0.2, 0.02), vec3(1.0, 0.62, 0.22), heat * heat) * heat * 1.1 * uHot;`);
  };
  bladeMat.customProgramCacheKey = () => 'verse1-war-blade';
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.castShadow = true;
  war.add(blade);
  // The hilt: a forged steel crossguard, a leather-wrapped grip and a wheel pommel, all worn by use.
  const steelMat = wornSteel({ repeat: [1.5, 1.5], env: stripEnv });
  steelMat.envMapIntensity = 1.6;
  const guardShape = new THREE.Shape();
  guardShape.moveTo(-0.07, -0.72); guardShape.quadraticCurveTo(0.02, 0, -0.07, 0.72); guardShape.lineTo(0.07, 0.72);
  guardShape.quadraticCurveTo(0.16, 0, 0.07, -0.72); guardShape.lineTo(-0.07, -0.72);
  const guardGeo = new THREE.ExtrudeGeometry(guardShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.022, bevelSegments: 3, curveSegments: 24 });
  guardGeo.translate(0, 0, -0.05);
  guardGeo.rotateX(Math.PI / 2); // lie in the table plane: the guard's length runs along z
  const guard = new THREE.Mesh(guardGeo, steelMat);
  guard.position.set(-0.04, 0, 0);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.95, 32, 1), leatherWrap({ repeat: [1, 1.2] }));
  grip.rotation.z = Math.PI / 2;
  grip.position.set(-0.6, 0, 0);
  const pommelPts = [[0, -0.07], [0.12, -0.07], [0.19, -0.04], [0.2, 0], [0.19, 0.04], [0.12, 0.07], [0, 0.07]].reverse().map(([r, y]) => new THREE.Vector2(r, y));
  const pommel = new THREE.Mesh(new THREE.LatheGeometry(pommelPts, 48), steelMat);
  pommel.rotation.z = Math.PI / 2;
  pommel.position.set(-1.14, 0, 0);
  for (const m of [guard, grip, pommel]) { m.castShadow = true; war.add(m); }
  war.position.y = BTH;
  // The coins it swallows: struck staters in a row along the blade.
  const rowCoins = [];
  for (let i = 0; i < 6; i++) {
    const c = new Coin({ radius: 0.36, thickness: 0.08, face, metal: 'gold', seed: 31 + i });
    c.castShadow = true;
    scene.add(c);
    rowCoins.push(c);
  }
  // the molten front lights what is around it
  const moltenLight = new THREE.PointLight(0xff8a30, 0, 2.2, 1.8);
  scene.add(moltenLight);

  const S = {
    scene, coin, blankCoin, floor, die, dieFace, faceMat, sparks, dust, key, rim, rake, war, blade, bladeMat, warU, rowCoins, moltenLight, BL,
    fx: { bloom: 0.32, threshold: 1.1, bloomRadius: 0.35, grain: 0.04, vignette: 0.5, tint: [1.02, 0.98, 0.92] },
    // Sparks from a point, or (rimR > 0) sprayed outward and low from a ring, as metal squirts from under a die.
    burst(t, t0, origin = [0, 0.1, 0], power = 1, rimR = 0) {
      const p = sparks.geometry.attributes.position.array;
      const dtt = t - t0;
      sparks.visible = dtt >= 0 && dtt < 0.9;
      if (!sparks.visible) return;
      for (let i = 0; i < NS; i++) {
        const a = hash1(i * 3) * Math.PI * 2, v = (1.5 + hash1(i * 3 + 2) * 4) * power;
        const e = rimR > 0 ? hash1(i * 3 + 1) * 0.45 + 0.03 : hash1(i * 3 + 1) * 0.9 + 0.1;
        p[i * 3] = origin[0] + Math.cos(a) * (rimR + Math.cos(e) * v * dtt);
        p[i * 3 + 1] = origin[1] + Math.sin(e) * v * dtt - 4.9 * dtt * dtt;
        p[i * 3 + 2] = origin[2] + Math.sin(a) * (rimR + Math.cos(e) * v * dtt);
      }
      sparks.geometry.attributes.position.needsUpdate = true;
      sparks.material.opacity = clamp(1 - dtt / 0.9);
    },
    update(ctx) {
      coin.visible = false;
      coin.position.set(0, 0.09, 0);
      coin.rotation.set(-Math.PI / 2, 0, 0);
      coin.setClip(0);
      coin.setEmissive([0, 0, 0], 0);
      coin.setRelief(1);
      rake.angle = 0.5; rake.penumbra = 0.6;
      blankCoin.visible = true;
      blankCoin.position.set(0, 0.09, 0);
      blankCoin.rotation.set(-Math.PI / 2, 0, 0);
      die.visible = true;
      die.position.set(0, 3, 0);
      die.rotation.set(0, 0, 0);
      sparks.visible = false;
      key.intensity = 9; key.color.set(0xffe2b0);
      key.position.set(-3.5, 4.5, 3.5); key.target.position.set(0, 0.2, 0);
      rim.intensity = 2.5;
      rake.intensity = 0; rake.color.set(0xffd9a8);
      war.visible = false;
      warU.uFront.value = 0; warU.uHot.value = 1;
      for (const c of rowCoins) { c.visible = false; c.scale.setScalar(1); c.setEmissive([0, 0, 0], 0); }
      coin.scale.setScalar(1);
      moltenLight.intensity = 0;
      rim.color.set(0xffb86b); rim.position.set(3, 2, -5);
      scene.environmentIntensity = 1.0;
      dust.visible = true;
      dust.setTime(ctx.t);
    },
  };
  return S;
}
