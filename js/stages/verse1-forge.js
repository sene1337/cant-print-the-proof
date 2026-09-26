// VERSE 1 forge stage: a crucible pours molten gold into a round blank mould; then the blank,
// cooled, spins like a small gold planet while coins come in from the dark to circle it.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { coinFace, normalFromHeight, loadImage, TEX } from '../tex.js';
import { clamp, hash1, easeOut, easeInOut, lerp, smooth } from '../util.js';
import { forgedIron } from '../props/verse1-metal.js';

const MOLTEN = /* glsl */ `
  uniform float uTime, uHeat;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

// Molten metal: hot yellow-white core, orange skin, bands flowing along the stream.
function moltenMaterial(U, { flow = 1, scale = [3, 14] } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `${MOLTEN}
      void main() {
        float f = clamp(dot(vN, vV), 0.0, 1.0);
        vec2 q = vec2(vUv.x * ${scale[0].toFixed(1)}, vUv.y * ${scale[1].toFixed(1)} - uTime * ${(3.2 * flow).toFixed(2)});
        float n = vnoise(q) * 0.6 + vnoise(q * 2.3 + 7.0) * 0.4;
        vec3 hot = vec3(1.0, 0.78, 0.36) * 2.3;
        vec3 skin = vec3(1.0, 0.42, 0.07) * 1.2;
        vec3 col = mix(skin, hot, pow(f, 1.5) * (0.65 + 0.5 * n));
        col *= uHeat;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function crucibleGeometry() {
  // Profile of a thick clay cup (outer wall up, lip, inner wall down).
  const pts = [];
  const push = (r, y) => pts.push(new THREE.Vector2(r, y));
  push(0.0, -0.5); push(0.34, -0.5); push(0.4, -0.46); push(0.47, -0.1); push(0.53, 0.38); push(0.56, 0.47);
  push(0.52, 0.5); push(0.47, 0.46); push(0.43, 0.0); push(0.36, -0.36); push(0.0, -0.4);
  const g = new THREE.LatheGeometry(pts, 96);
  // Pull a pouring spout out of the rim at angle 0 (+X).
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = Math.exp(-(a * a) / 0.08) * clamp((y - 0.1) / 0.4, 0, 1);
    const r = Math.hypot(x, z);
    const s = (r + 0.12 * k) / Math.max(1e-6, r);
    p.setXYZ(i, x * s, y + 0.03 * k, z * s * (1 - 0.3 * k));
  }
  g.computeVertexNormals();
  return g;
}

function hotRimTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, '#000000'); gr.addColorStop(0.45, '#050100'); gr.addColorStop(0.55, '#ff6a10');
  gr.addColorStop(0.62, '#ffb040'); gr.addColorStop(0.72, '#ff5a08'); gr.addColorStop(0.8, '#1a0400'); gr.addColorStop(1, '#000000');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A tube of varying radius along a curve.
function taperedTube(curve, segs, radial, radius) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = g.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs);
    const r = radius(i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

// An environment of soft lobes over a smooth vertical gradient. lobes: { dir, color, gain, width }.
function lobeEnv(renderer, lobes, { top, mid, bottom }) {
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(50, 96, 48);
  const p = dome.attributes.position;
  const col = [];
  const L = lobes.map((l) => ({ ...l, d: new THREE.Vector3(...l.dir).normalize() }));
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const y = v.y;
    const t = (y + 1) / 2; // 0 bottom .. 1 top, smooth
    const base = [0, 1, 2].map((k) => (t < 0.5 ? bottom[k] + (mid[k] - bottom[k]) * smooth(t * 2) : mid[k] + (top[k] - mid[k]) * smooth(t * 2 - 1)));
    for (const l of L) {
      const w = Math.exp((v.dot(l.d) - 1) / l.width) * l.gain;
      base[0] += l.color[0] * w; base[1] += l.color[1] * w; base[2] += l.color[2] * w;
    }
    col.push(...base);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.01).texture;
  pmrem.dispose();
  return tex;
}

// A freshly cast and hammered blank: flat hammer facets, casting pits, a raised rim; colour with faint mottling.
// Mapped like the coin faces (the disc fills the canvas; repeat 0.5, offset 0.5 on the face's shape coordinates).
function castBlankTextures(size = 1024) {
  const R = size / 2;
  const hc = document.createElement('canvas'); hc.width = hc.height = size;
  const hg = hc.getContext('2d');
  const img = hg.createImageData(size, size);
  const NP = 46;
  const pts = [];
  for (let i = 0; i < NP; i++) {
    const a = hash1(i * 5 + 1) * Math.PI * 2, r = Math.sqrt(hash1(i * 5 + 2)) * R * 0.95;
    pts.push({ x: R + Math.cos(a) * r, y: R + Math.sin(a) * r, sx: (hash1(i * 5 + 3) - 0.5) * 0.9, sy: (hash1(i * 5 + 4) - 0.5) * 0.9, b: hash1(i * 5 + 5) });
  }
  const facet = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let best = 1e9, bi = 0;
      for (let k = 0; k < NP; k++) { const dx = x - pts[k].x, dy = y - pts[k].y, d = dx * dx + dy * dy; if (d < best) { best = d; bi = k; } }
      const p = pts[bi];
      const h = 0.5 + (p.sx * (x - p.x) + p.sy * (y - p.y)) / R * 0.6; // a tilted flat facet per hammer blow
      facet[y * size + x] = bi;
      const v = Math.max(0, Math.min(255, h * 255));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  hg.putImageData(img, 0, 0);
  // soften the facet edges a touch
  const sc = document.createElement('canvas'); sc.width = sc.height = size;
  const sg = sc.getContext('2d');
  sg.filter = 'blur(2px)'; sg.drawImage(hc, 0, 0); sg.filter = 'none';
  // casting pits
  for (let i = 0; i < 320; i++) {
    const a = hash1(i * 3 + 11) * Math.PI * 2, r = Math.sqrt(hash1(i * 3 + 12)) * R * 0.9;
    const x = R + Math.cos(a) * r, y = R + Math.sin(a) * r, pr = 1.2 + Math.pow(hash1(i * 3 + 13), 3) * 5;
    const gr = sg.createRadialGradient(x, y, 0, x, y, pr);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gr; sg.fillRect(x - pr, y - pr, pr * 2, pr * 2);
  }
  // the raised rim: a bright ring near the edge, falling softly inward
  sg.lineWidth = R * 0.07; sg.strokeStyle = 'rgba(255,255,255,0.95)';
  sg.beginPath(); sg.arc(R, R, R * 0.945, 0, Math.PI * 2); sg.stroke();
  sg.lineWidth = R * 0.12; sg.strokeStyle = 'rgba(255,255,255,0.25)';
  sg.beginPath(); sg.arc(R, R, R * 0.9, 0, Math.PI * 2); sg.stroke();
  const normal = normalFromHeight(sc, 2.2, 1.2);
  normal.repeat.set(0.5, 0.5); normal.offset.set(0.5, 0.5);
  // colour: warm gold-white with faint facet-to-facet variation and darker pits
  const cc = document.createElement('canvas'); cc.width = cc.height = size;
  const cg = cc.getContext('2d');
  cg.fillStyle = '#efe7d6'; cg.fillRect(0, 0, size, size);
  const cimg = cg.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const f = 0.93 + 0.07 * pts[facet[i]].b;
    cimg.data[i * 4] *= f; cimg.data[i * 4 + 1] *= f; cimg.data[i * 4 + 2] *= f;
  }
  cg.putImageData(cimg, 0, 0);
  for (let i = 0; i < 320; i++) {
    const a = hash1(i * 3 + 11) * Math.PI * 2, r = Math.sqrt(hash1(i * 3 + 12)) * R * 0.9;
    const x = R + Math.cos(a) * r, y = R + Math.sin(a) * r, pr = 1.2 + Math.pow(hash1(i * 3 + 13), 3) * 5;
    const gr = cg.createRadialGradient(x, y, 0, x, y, pr);
    gr.addColorStop(0, 'rgba(120,90,50,0.35)'); gr.addColorStop(1, 'rgba(120,90,50,0)');
    cg.fillStyle = gr; cg.fillRect(x - pr, y - pr, pr * 2, pr * 2);
  }
  const color = new THREE.CanvasTexture(cc);
  color.colorSpace = THREE.SRGBColorSpace; color.anisotropy = 8;
  color.repeat.set(0.5, 0.5); color.offset.set(0.5, 0.5);
  return { normal, color };
}

export async function forgeStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const env = studioEnv(film.renderer, [
    { pos: [0, 6, 1.5], size: [6, 2.5], color: [1, 0.9, 0.78], intensity: 2.2 },
    { pos: [-6, 1.2, 2], size: [0.5, 5], color: [1, 0.82, 0.62], intensity: 3.0 },
    { pos: [6, 0.8, -1], size: [0.4, 5], color: [1, 0.92, 0.8], intensity: 2.4 },
    { pos: [0, -1, -6], size: [7, 0.5], color: [1, 0.55, 0.2], intensity: 2.5 },
    { pos: [0, 2.5, 7], size: [9, 5], color: [1, 0.85, 0.62], intensity: 1.4 },
  ], { top: [0.42, 0.34, 0.26], horizon: [0.2, 0.13, 0.07], bottom: [0.09, 0.05, 0.022] });
  scene.environment = env;

  const U = { uTime: { value: 0 }, uHeat: { value: 1 } };
  const forge = new THREE.Group();
  scene.add(forge);

  // The mould: a dark iron block with a round cavity the size of a blank.
  const BR = 0.5;
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.55, metalness: 0.7 });
  const mouldPts = [[1.02, -0.6], [1.0, -0.03], [0.95, 0.012], [BR + 0.02, 0.012], [BR, 0], [BR, -0.12], [0, -0.12]].map(([r, y]) => new THREE.Vector2(r, y));
  const mould = new THREE.Mesh(new THREE.LatheGeometry(mouldPts, 128), ironMat);
  mould.material.side = THREE.DoubleSide;
  forge.add(mould);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.2, 64), new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.8, metalness: 0.2 }));
  table.position.y = -0.7;
  forge.add(table);
  // The molten fill rising in the cavity.
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(BR * 0.995, BR * 0.995, 1, 96, 1), moltenMaterial(U, { flow: 0.15, scale: [6, 3] }));
  forge.add(fill);

  // Crucible, tilted over the mould, with its molten load.
  const crucible = new THREE.Group();
  const cMat = new THREE.MeshStandardMaterial({ color: 0x2a221d, roughness: 0.85, metalness: 0.1, emissive: 0xffffff, emissiveMap: hotRimTexture(), emissiveIntensity: 1.2 });
  const cup = new THREE.Mesh(crucibleGeometry(), cMat);
  crucible.add(cup);
  const load = new THREE.Mesh(new THREE.CircleGeometry(0.44, 64), moltenMaterial(U, { flow: 0.3, scale: [4, 4] }));
  load.rotation.x = -Math.PI / 2;
  load.position.y = 0.43;
  crucible.add(load);
  forge.add(crucible);
  // Tongs holding it from the upper left, and the iron ring round its waist.
  const tongMat = forgedIron({ repeat: [1, 4] });
  const CPOS = new THREE.Vector3(-0.96, 1.4, 0);
  for (const z of [-0.6, 0.6]) {
    const a = CPOS.clone().add(new THREE.Vector3(0, 0, z));
    const b = CPOS.clone().add(new THREE.Vector3(-3.2, 1.6, z * 0.7));
    const len = a.distanceTo(b);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, len, 14), tongMat);
    t.position.copy(a).add(b).multiplyScalar(0.5);
    t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    forge.add(t);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.575, 0.03, 10, 64), tongMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  crucible.add(ring);

  // The pour: ballistic from the spout lip into the cavity.
  const lip = new THREE.Vector3(-0.3, 0.9, 0);
  const land = new THREE.Vector3(0.02, -0.1, 0);
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    pts.push(new THREE.Vector3(lerp(lip.x, land.x, u), lerp(lip.y, land.y, u * u), 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const stream = new THREE.Mesh(taperedTube(curve, 80, 16, (u) => 0.055 - 0.025 * Math.sqrt(u) + 0.004 * Math.sin(u * 40)), moltenMaterial(U, { flow: 1.2, scale: [2, 10] }));
  forge.add(stream);
  const splash = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 10, 32), moltenMaterial(U, { flow: 0.5, scale: [4, 2] }));
  splash.rotation.x = Math.PI / 2;
  forge.add(splash);

  // Embers.
  const NE = 300;
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NE * 3), 3));
  const embers = new THREE.Points(eGeo, new THREE.PointsMaterial({ size: 0.02, color: new THREE.Color(1, 0.55, 0.15).multiplyScalar(5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false;
  forge.add(embers);

  const hotLight = new THREE.PointLight(0xff9a40, 6, 8, 1.4);
  hotLight.position.set(0, 0.3, 0.3);
  forge.add(hotLight);
  const key = new THREE.SpotLight(0xffe2b0, 14, 30, 0.6, 1.0, 1.5);
  key.position.set(-3, 5, 4);
  forge.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb86b, 2.0);
  rim.position.set(3, 2, -5);
  forge.add(rim);

  // The planet: the cooled blank, and coins that come in from the dark to circle it.
  const planet = new THREE.Group();
  scene.add(planet);
  // Its own studio, made only of soft round lobes of light: a flat gold face mirrors any straight edge
  // (a soft box, a horizon) as a hard line across the coin, so there are none.
  const planetEnv = lobeEnv(film.renderer, [
    { dir: [-0.55, 0.6, 0.6], color: [1, 0.86, 0.66], gain: 2.4, width: 0.09 },
    { dir: [0.1, 0.5, 1], color: [1, 0.82, 0.58], gain: 0.9, width: 0.45 },
    { dir: [1, 0.2, -0.35], color: [1, 0.72, 0.42], gain: 1.6, width: 0.05 },
    { dir: [0.2, -0.6, 0.8], color: [0.9, 0.55, 0.26], gain: 0.5, width: 0.35 },
  ], { top: [0.26, 0.19, 0.12], mid: [0.17, 0.11, 0.06], bottom: [0.08, 0.05, 0.025] });
  const blankFace = await coinFace('stater', { blank: true });
  const blank = new Coin({ radius: 1, thickness: 0.16, face: blankFace, metal: 'gold', seed: 12, env: planetEnv });
  // a cast blank, hammered flat: facets, pits and a raised rim that catches the light
  const castTex = castBlankTextures();
  blank.faceMat.roughness = 0.26; blank.sideMat.roughness = 0.3;
  blank.faceMat.envMapIntensity = 1.3; blank.sideMat.envMapIntensity = 1.3;
  blank.faceMat.normalMap = castTex.normal; blank.faceMat.map = castTex.color;
  blank.faceMat.normalScale.set(1, 1);
  planet.add(blank);
  // The coins that come to it: struck gold staters with the king's face, drawn as one instanced mesh.
  const NC = 120;
  const struck = await coinFace('stater', { size: 512 });
  // Softer face colour for these small, drifting coins: their fine relief would otherwise shimmer as it moves.
  {
    const im = await loadImage(`${TEX.base}tex/stater_photo.jpg`);
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#e9e4da'; g.fillRect(0, 0, 512, 512);
    g.save(); g.beginPath(); g.arc(256, 256, 256 * 0.925, 0, Math.PI * 2); g.clip();
    g.filter = 'grayscale(1) contrast(0.8) brightness(1.12) blur(1.2px)';
    g.drawImage(im, 256 - 256 * 0.955, 256 - 256 * 0.955, 512 * 0.955, 512 * 0.955);
    g.restore();
    g.lineWidth = 256 * 0.075 * 1.1; g.strokeStyle = '#f4efe6';
    g.beginPath(); g.arc(256, 256, 256 * (1 - 0.075 * 0.45), 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    struck.color = t;
  }
  const coinGeo = new THREE.CylinderGeometry(1, 1, 0.12, 48, 1);
  const coinSide = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(1.0, 0.72, 0.3), metalness: 1, roughness: 0.3, envMap: planetEnv });
  const coinFaceMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.74, 0.32), metalness: 1, roughness: 0.26, envMap: planetEnv,
    map: struck.color, normalMap: struck.normal, normalScale: new THREE.Vector2(0.85, 0.85),
  });
  // No single glint may flare the bloom for a frame: cap each pixel's brightness.
  for (const m of [coinSide, coinFaceMat, blank.faceMat, blank.sideMat]) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = min(outgoingLight, vec3(2.2));\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'verse1-capped';
  }
  const coins = new THREE.InstancedMesh(coinGeo, [coinSide, coinFaceMat, coinFaceMat], NC);
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  coins.frustumCulled = false;
  planet.add(coins);
  // The glow sits on a plane well behind the blank (the camera looks down -Z in this shot): a glow plane
  // through the coin itself would light the half of the tilted coin behind it and leave a hard line.
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,190,110,0.5)'); gr.addColorStop(0.4, 'rgba(255,150,60,0.15)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.position.set(0, 0, -3.2);
  planet.add(halo);
  const planetKey = new THREE.DirectionalLight(0xffe6c0, 1.6);
  planetKey.position.set(-4, 3, 5);
  planet.add(planetKey);

  const dummy = new THREE.Object3D();
  const S = {
    scene, env, forge, planet, crucible, cup, load, stream, splash, fill, mould, embers, hotLight, key, rim, blank, coins, halo, U, curve, BR,
    fx: { bloom: 0.5, threshold: 1.0, bloomRadius: 0.45, grain: 0.05, vignette: 0.5, tint: [1.03, 0.98, 0.9] },
    // k: 0..1 how full the mould is. flow: 0..1 stream on/off.
    pour(t, k, flow) {
      fill.visible = k > 0.01;
      const depth = 0.12 * clamp(k);
      fill.scale.set(1, Math.max(0.001, depth), 1);
      fill.position.y = -0.12 + depth / 2;
      stream.visible = flow > 0.02;
      stream.scale.set(1, 1, 1);
      splash.visible = flow > 0.02 && k > 0.01;
      splash.position.set(land.x, -0.12 + depth + 0.005, 0);
      splash.scale.setScalar(0.8 + 0.3 * Math.sin(t * 23));
      hotLight.intensity = 3 + 6 * clamp(k) + 4 * flow;
      // embers: born at the landing point, thrown up and out
      const p = embers.geometry.attributes.position.array;
      for (let i = 0; i < NE; i++) {
        const life = 0.7 + hash1(i * 4 + 1) * 0.6;
        const age = ((t * 0.9 + hash1(i * 4 + 2) * life) % life);
        const a = hash1(i * 4 + 3) * Math.PI * 2, v = 0.6 + hash1(i * 4 + 4) * 1.4;
        p[i * 3] = land.x + Math.cos(a) * v * age * 0.6;
        p[i * 3 + 1] = -0.1 + depth + v * age * 1.4 - 2.4 * age * age;
        p[i * 3 + 2] = Math.sin(a) * v * age * 0.6;
        if (flow < 0.02) p[i * 3 + 1] = -100;
      }
      embers.geometry.attributes.position.needsUpdate = true;
    },
    // Coins come in from the dark on spiral paths and settle into a ring orbiting the blank. k: 0..1 arrival.
    orbit(t, k) {
      let n = 0;
      const tilt = 0.32, cT = Math.cos(tilt), sT = Math.sin(tilt);
      for (let i = 0; i < NC; i++) {
        // Coins emerge out of the dark: each grows in while drifting gently inward to its orbit, so a patch of
        // screen brightens once, gradually, instead of flashing as a coin streaks across it.
        const delay = hash1(i * 7 + 1) * 0.35;
        const a = clamp((k - delay) / 0.62);
        if (a <= 0) continue;
        const e = smooth(a);
        const R0 = 2.3 + hash1(i * 7 + 2) * 1.1;
        const Rs = R0 + (1 - e) * (0.9 + hash1(i * 7 + 8) * 0.6);
        const ph = hash1(i * 7 + 3) * Math.PI * 2 + t * 0.55 / Math.sqrt(R0 / 2.3) - (1 - e) * 0.35; // a slow, stately orbit
        const yOff = (hash1(i * 7 + 4) - 0.5) * 0.25 + (1 - e) * (hash1(i * 7 + 6) - 0.5) * 0.6;
        const ox = Math.cos(ph) * Rs, oz = Math.sin(ph) * Rs;
        const grow = smooth(a * 1.6);
        dummy.position.set(ox, yOff * cT - oz * sT, yOff * sT + oz * cT);
        dummy.rotation.set(t * (0.25 + hash1(i) * 0.45) + i, t * 0.2 + i * 0.3, 0.5);
        dummy.scale.setScalar((0.2 + hash1(i * 7 + 9) * 0.08) * grow);
        dummy.updateMatrix();
        coins.setMatrixAt(n++, dummy.matrix);
      }
      coins.count = n;
      coins.instanceMatrix.needsUpdate = true;
    },
    update(ctx) {
      U.uTime.value = ctx.t; U.uHeat.value = 1;
      forge.visible = false;
      planet.visible = false;
      crucible.position.copy(CPOS);
      crucible.rotation.set(0, 0, -1.25);
      blank.position.set(0, 0, 0);
      blank.rotation.set(0, 0, 0);
      halo.scale.setScalar(6.8);
      coins.count = 0;
    },
  };
  return S;
}
