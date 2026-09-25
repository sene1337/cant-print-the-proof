// VERSE 1 mint stage: a copy of the shared gold studio (same coin, blank, floor and sparks) whose die carries
// the king's portrait cut into its face in mirror relief, so we can see what is about to be struck.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Coin, METALS } from '../props/coin.js';
import { Dust } from '../props/dust.js';
import { coinFace, edgeText, normalFromHeight, loadImage, TEX } from '../tex.js';
import { clamp, hash1, rng } from '../util.js';

// The die face: the stater relief inverted (sunk into the steel) and mirrored, like a real coin die.
async function dieFaceTextures({ size = 1024, rim = 0.075 } = {}) {
  const hIm = await loadImage(`${TEX.base}tex/stater_height.png`);
  const R = size / 2, s = 1 - rim * 0.6;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  // coin heights first (white = high on the coin), mirrored left-right
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, size, size);
  g.save();
  g.translate(size, 0); g.scale(-1, 1);
  g.beginPath(); g.arc(R, R, R * (1 - rim), 0, Math.PI * 2); g.clip();
  g.filter = 'blur(6px)';
  g.drawImage(hIm, R - R * s, R - R * s, size * s, size * s);
  g.restore();
  g.filter = 'none';
  g.lineWidth = R * rim * 1.1; g.strokeStyle = '#f2f2f2';
  g.beginPath(); g.arc(R, R, R * (1 - rim * 0.45), 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#d8d8d8';
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    g.beginPath(); g.arc(R + Math.cos(a) * R * (1 - rim * 1.35), R + Math.sin(a) * R * (1 - rim * 1.35), R * 0.011, 0, Math.PI * 2); g.fill();
  }
  // die heights are the inverse: what stands up on the coin is cut down into the die
  const inv = document.createElement('canvas');
  inv.width = inv.height = size;
  const ig = inv.getContext('2d');
  ig.filter = 'invert(1)';
  ig.drawImage(c, 0, 0);
  const normal = normalFromHeight(inv, 2.4, 7);
  // colour: polished steel, darker and warmer down in the cut
  const col = document.createElement('canvas');
  col.width = col.height = size;
  const cg = col.getContext('2d');
  cg.fillStyle = '#e4e6e8'; cg.fillRect(0, 0, size, size);
  cg.globalCompositeOperation = 'multiply';
  cg.filter = 'blur(3px) contrast(1.8) brightness(1.05)';
  cg.drawImage(inv, 0, 0);
  cg.globalCompositeOperation = 'source-over';
  cg.filter = 'none';
  const color = new THREE.CanvasTexture(col);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;
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
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xa9aeb4, metalness: 1, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.08, 2.4, 128, 1, true), steel);
  body.castShadow = true;
  die.add(body);
  const bevel = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 12, 128), steel);
  bevel.rotation.x = Math.PI / 2;
  bevel.position.y = -1.2;
  die.add(bevel);
  const dt = await dieFaceTextures();
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xc4c8cc, metalness: 0.35, roughness: 0.55, map: dt.color, normalMap: dt.normal, normalScale: new THREE.Vector2(1.3, 1.3),
  });
  const dieFace = new THREE.Mesh(new THREE.CircleGeometry(1.0, 128), faceMat);
  dieFace.rotation.x = Math.PI / 2; // faces down
  dieFace.position.y = -1.2;
  die.add(dieFace);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.08, 64), steel);
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

  // The war blade: a sword. Its cutting edge is the local x axis (the origin is where it meets the coin),
  // y is up across the blade, z is through its thickness. Diamond section, so the bevels catch the light.
  const L0 = -1.75, L1 = 1.05, BW = 0.13, BT = 0.016;
  const halfW = (x) => { const u = (x - L0) / (L1 - L0); return BW * (1 - 0.2 * u) * (u > 0.8 ? Math.sqrt(Math.max(0, (1 - u) / 0.2)) : 1); };
  const sec = (x) => { const hw = Math.max(halfW(x), 0.0004); return [[x, 0, 0], [x, hw, BT], [x, 2 * hw, 0], [x, hw, -BT]]; };
  const bp = [];
  const NB = 48;
  for (let i = 0; i < NB; i++) {
    const a = sec(L0 + ((L1 - L0) * i) / NB), b = sec(L0 + ((L1 - L0) * (i + 1)) / NB);
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      bp.push(...a[k], ...a[k2], ...b[k2], ...a[k], ...b[k2], ...b[k]);
    }
  }
  const bladeGeo = new THREE.BufferGeometry();
  bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  bladeGeo.computeVertexNormals();
  const blade = new THREE.Group();
  const bladeMat = new THREE.MeshPhysicalMaterial({ color: 0xd8dde3, metalness: 0.9, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  const steelBlade = new THREE.Mesh(bladeGeo, bladeMat);
  const hiltMat = new THREE.MeshPhysicalMaterial({ color: 0xb08a4a, metalness: 1, roughness: 0.3 });
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.09), hiltMat);
  guard.position.set(L0 - 0.03, BW, 0);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.55, 16), new THREE.MeshStandardMaterial({ color: 0x1a0d08, roughness: 0.8 }));
  grip.rotation.z = Math.PI / 2;
  grip.position.set(L0 - 0.33, BW, 0);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), hiltMat);
  pommel.position.set(L0 - 0.64, BW, 0);
  const glint = new THREE.Mesh(new THREE.BoxGeometry((L1 - L0) * 0.8, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.78, 0.6).multiplyScalar(2.6) }));
  glint.position.set(L0 + (L1 - L0) * 0.4, 0.002, 0);
  blade.add(steelBlade, guard, grip, pommel, glint);
  blade.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(blade);
  const bladeLight = new THREE.SpotLight(0xffc0a0, 0, 20, 0.5, 0.8, 1.2);
  scene.add(bladeLight, bladeLight.target);
  // A pool of red light on the floor behind the blade (a fire off-screen), so the steel stands in silhouette.
  const hazeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: hazeTex, color: new THREE.Color(1.0, 0.16, 0.05).multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  haze.rotation.x = -Math.PI / 2;
  scene.add(haze);

  // The sliver the blade takes: the same segment the coin loses at clip 0.12 (first notch of seed 11).
  const R0 = rng(11);
  const na = R0() * Math.PI * 2, nw = 0.12 + R0() * 0.25, nd = 0.05 + R0() * 0.11;
  const sh = new THREE.Shape();
  const NSEG = 40;
  for (let i = 0; i <= NSEG; i++) { const a = na - nw + (2 * nw * i) / NSEG; const x = Math.cos(a), y = Math.sin(a); i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  for (let i = NSEG; i >= 0; i--) { const a = na - nw + (2 * nw * i) / NSEG; const r = Math.min(1, (1 - nd) / Math.cos(a - na)); sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  const T = 0.16, bev = T * 0.18;
  const sliverGeo = new THREE.ExtrudeGeometry(sh, { depth: T - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 3, curveSegments: 1 });
  sliverGeo.translate(0, 0, -(T - bev * 2) / 2);
  // pivot the sliver about its own centre so it can tumble
  const mid = new THREE.Vector3(Math.cos(na) * (1 - nd * 0.5), Math.sin(na) * (1 - nd * 0.5), 0);
  sliverGeo.translate(-mid.x, -mid.y, 0);
  const sliverMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(...METALS.gold.color), metalness: 1, roughness: METALS.gold.roughness + 0.05 });
  const sliver = new THREE.Mesh(sliverGeo, sliverMat);
  sliver.castShadow = true;
  scene.add(sliver);
  const notch = { a: na, w: nw, d: nd, mid };

  const S = {
    scene, coin, blankCoin, floor, die, dieFace, faceMat, sparks, dust, key, rim, rake, blade, bladeMat, glint, bladeLight, sliver, notch, haze,
    fx: { bloom: 0.32, threshold: 1.1, bloomRadius: 0.35, grain: 0.04, vignette: 0.5, tint: [1.02, 0.98, 0.92] },
    burst(t, t0, origin = [0, 0.1, 0], power = 1) {
      const p = sparks.geometry.attributes.position.array;
      const dtt = t - t0;
      sparks.visible = dtt >= 0 && dtt < 0.9;
      if (!sparks.visible) return;
      for (let i = 0; i < NS; i++) {
        const a = hash1(i * 3) * Math.PI * 2, e = hash1(i * 3 + 1) * 0.9 + 0.1, v = (1.5 + hash1(i * 3 + 2) * 4) * power;
        p[i * 3] = origin[0] + Math.cos(a) * Math.cos(e) * v * dtt;
        p[i * 3 + 1] = origin[1] + Math.sin(e) * v * dtt - 4.9 * dtt * dtt;
        p[i * 3 + 2] = origin[2] + Math.sin(a) * Math.cos(e) * v * dtt;
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
      blade.visible = false;
      bladeLight.intensity = 0;
      sliver.visible = false;
      haze.visible = false;
      rim.color.set(0xffb86b); rim.position.set(3, 2, -5);
      scene.environmentIntensity = 1.0;
      dust.visible = true;
      dust.setTime(ctx.t);
    },
  };
  return S;
}
