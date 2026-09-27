// VERSE 1 night stage: moonlit sea, a cowrie on a string, salt, the rai-stone canoe, the shore stone,
// and the island whose stones keep the first shared ledger. Palette: moonlit teal and bone.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { studioEnv } from '../film.js';
import { loadImage, TEX } from '../tex.js';
import { clamp, hash1, lerp, easeOut, smooth } from '../util.js';
import { hangingCowrie, cowrieEnv } from '../props/verse1-cowrie.js';
import { raiGeometry, raiMaterial, raiTextures } from '../props/verse1-rai.js';
import { palmGeometry } from '../props/verse1-palm.js';
import { canoe as makeCanoe } from '../props/verse1-canoe.js';

const HORIZON = new THREE.Color(0.02, 0.058, 0.068);
const ZENITH = new THREE.Color(0.001, 0.0035, 0.008);
const MOONCOL = new THREE.Color(1.0, 0.96, 0.88);

// Where each set lives. They are far apart so they never appear in each other's shots.
export const SETS = {
  shell: new THREE.Vector3(-400, 0, 300),
  canoe: new THREE.Vector3(420, 0, -300),
  beach: new THREE.Vector3(0, 0, 700),
  island: new THREE.Vector3(0, 0, 0),
};

const GLSL_HASH = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

const SKY_FN = /* glsl */ `
  uniform vec3 uMoonDir, uHorizon, uZenith, uMoonCol;
  uniform float uMoonR, uHalo;
  vec3 skyCol(vec3 d) {
    float e = max(d.y, 0.0);
    vec3 c = mix(uHorizon, uZenith, pow(e, 0.42));
    float ang = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
    float edge = max(ang - uMoonR, 0.0);
    c += uMoonCol * uHalo * (0.7 * exp(-edge / 0.035) + 0.2 * exp(-edge / 0.25));
    return c;
  }
`;

function skyMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `${SKY_FN}
      varying vec3 vDir;
      void main() { gl_FragColor = vec4(skyCol(normalize(vDir)), 1.0); }`,
  });
}

function seaMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U, fog: false,
    vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${SKY_FN}${GLSL_HASH}
      uniform float uTime, uGlint, uFogDist, uChop, uPathW, uSparkF, uSparkGain;
      uniform vec3 uWater, uFogCol;
      varying vec3 vW;
      void main() {
        vec3 toP = vW - cameraPosition;
        float dist = length(toP);
        vec3 V = toP / dist;
        float fw = max(length(fwidth(vW.xz)), 1e-4);
        // Swell: a few long waves, faded out where a pixel can no longer resolve them.
        vec2 grad = vec2(0.0);
        for (int i = 0; i < 9; i++) {
          float fi = float(i);
          float ang = fi * 2.39996 + 0.7;
          vec2 d = vec2(cos(ang), sin(ang));
          float lambda = 16.0 * pow(0.66, fi);
          float k = 6.2831853 / lambda;
          float w = sqrt(9.81 * k);
          float res = clamp(1.0 - fw / (lambda * 0.35), 0.0, 1.0);
          grad += d * 0.055 * uChop * cos(dot(d, vW.xz) * k - w * uTime + fi * 1.93) * res;
        }
        vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
        vec3 R = reflect(V, N);
        R.y = abs(R.y);
        float cosI = clamp(dot(-V, N), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosI, 5.0);
        vec3 refl = skyCol(R);
        // The moon path: a soft lobe around the mirror direction...
        float ang = acos(clamp(dot(R, uMoonDir), -1.0, 1.0));
        float path = exp(-ang * ang / (2.0 * uPathW * uPathW));
        // ...broken into glitter: sparse facets that flash and drift. Mean-preserving where unresolved.
        vec2 q = vW.xz * uSparkF;
        float n1 = vnoise(q + vec2(uTime * 0.9, -uTime * 0.6));
        float n2 = vnoise(q * 1.73 + vec2(-uTime * 0.7, uTime * 1.1) + 17.0);
        float n3 = vnoise(q * 3.1 + vec2(uTime * 1.6, uTime * 0.4) + 41.0);
        float sp = pow(n1 * n2 * (0.4 + n3), 5.0) * uSparkGain;
        float resS = clamp(1.0 - fw * uSparkF * 1.2, 0.0, 1.0);
        float spark = mix(1.0, sp, resS);
        refl += uMoonCol * uGlint * path * spark;
        vec3 col = mix(uWater, refl, F);
        col = min(col, vec3(4.0)); // no single glint may flare the bloom
        float fog = 1.0 - exp(-dist / uFogDist);
        col = mix(col, uFogCol, fog);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function discAlpha(size = 512, r = 0.992, soft = 0.006) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, size / 2 * (r - soft), size / 2, size / 2, size / 2 * r);
  gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  g.fillStyle = gr; g.beginPath(); g.arc(size / 2, size / 2, size / 2 * r, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

function glowSprite(size = 256, stops = [[0, 1], [0.2, 0.45], [0.5, 0.1], [1, 0]]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function saltTex() {
  const n = 512, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = '#cfd6d5'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 9000; i++) {
    const x = hash1(i * 3 + 1) * n, y = hash1(i * 3 + 2) * n, r = 1 + hash1(i * 3 + 3) * 3.5;
    const v = 150 + hash1(i * 7 + 9) * 105 | 0;
    g.fillStyle = `rgb(${v},${v + 3},${v + 3})`;
    g.fillRect(x, y, r, r * (0.7 + hash1(i) * 0.6));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 3);
  return t;
}
// Random facets: every grain tilts its own way, so moonlight catches some of them.
function saltNormal() {
  const n = 512, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 9000; i++) {
    const x = hash1(i * 3 + 1) * n, y = hash1(i * 3 + 2) * n, r = 1.5 + hash1(i * 3 + 3) * 3.5;
    const a = hash1(i * 5 + 4) * 6.283, k = 0.3 + hash1(i * 5 + 5) * 0.5;
    const nx = Math.cos(a) * k, ny = Math.sin(a) * k, nz = Math.sqrt(Math.max(0, 1 - k * k));
    g.fillStyle = `rgb(${(nx * 0.5 + 0.5) * 255 | 0},${(ny * 0.5 + 0.5) * 255 | 0},${(nz * 0.5 + 0.5) * 255 | 0})`;
    g.fillRect(x, y, r, r);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 3);
  return t;
}

// Salt: glassy cubes pour from above and heap into a cone. A pure function of time since the pour began.
// Irregular crystal shapes: jittered, flat-shaded polyhedra (a chunk, a shard, a flake).
function crystalGeometry(kind, seed) {
  let g = kind === 0 ? new THREE.BoxGeometry(1, 0.8, 0.9) : kind === 1 ? new THREE.OctahedronGeometry(0.75) : new THREE.DodecahedronGeometry(0.62);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const sc = [[1, 1, 1], [1, 0.72, 1.12], [1.25, 0.5, 0.95]][kind];
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, (p.getX(i) + (hash1(seed + i * 3) - 0.5) * 0.3) * sc[0], (p.getY(i) + (hash1(seed + i * 3 + 1) - 0.5) * 0.3) * sc[1], (p.getZ(i) + (hash1(seed + i * 3 + 2) - 0.5) * 0.3) * sc[2]);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// Salt: irregular translucent crystals pour from above and heap into a cone. A pure function of time.
function saltPour(env) {
  const N = 3300, KINDS = 3;
  const group = new THREE.Group();
  const backWorld = new THREE.Vector3(0, 0.2, -1).normalize();
  // Salt is translucent white: with the moon behind it the crystals glow from inside, brightest at their edges.
  // Highlights are kept broad and every pixel is capped, so no single facet can flare the bloom for one frame.
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe4e9e8, roughness: 0.5, metalness: 0, envMap: env, envMapIntensity: 0.55, flatShading: true,
    emissive: new THREE.Color(0.08, 0.09, 0.095),
  });
  const backU = { uBackDir: { value: new THREE.Vector3(0, 0, -1) }, uBackCol: { value: new THREE.Color(0.85, 0.93, 0.95) }, uClamp: { value: 2.2 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, backU);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBackDir, uBackCol; uniform float uClamp;')
      .replace('#include <opaque_fragment>', `
        float back = pow(max(dot(-geometryViewDir, uBackDir), 0.0), 3.0);
        float edge = 1.0 - abs(dot(normal, geometryViewDir));
        outgoingLight += uBackCol * back * (0.35 + 0.9 * edge) * diffuseColor.rgb;
        outgoingLight = min(outgoingLight, vec3(uClamp));
        #include <opaque_fragment>`);
  };
  const meshes = [];
  for (let k = 0; k < KINDS; k++) {
    const m = new THREE.InstancedMesh(crystalGeometry(k, 71 + k * 997), mat, Math.ceil(N / KINDS));
    // the backlight direction is set in view space at draw time, from the camera actually used
    m.onBeforeRender = (r, sc, camera) => { backU.uBackDir.value.copy(backWorld).transformDirection(camera.matrixWorldInverse); };
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = true;
    const colors = new Float32Array(m.count * 3);
    for (let i = 0; i < m.count; i++) { const v = 0.88 + hash1(i * 7 + 5 + k) * 0.14; colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v * 0.98; }
    m.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    group.add(m);
    meshes.push(m);
  }
  const mesh = meshes[0];
  const coneMat = new THREE.MeshStandardMaterial({ map: saltTex(), normalMap: saltNormal(), normalScale: new THREE.Vector2(1.2, 1.2), color: 0xeef2f1, roughness: 0.55, envMap: env, envMapIntensity: 0.55, emissive: new THREE.Color(0.2, 0.215, 0.22) });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 96, 1, true), coneMat);
  cone.receiveShadow = true;
  group.add(cone);
  // The falling salt: one continuous stream of fine grains, drawn on a ribbon that turns to face the camera.
  // Each grain follows free fall (it is identified by its release time), so the stream thins and speeds up as it
  // falls. Grains are much smaller than a tenth of the frame, so no patch of the stream flickers as they pass.
  const streamU = {
    uTime: { value: 0 }, uH: { value: 0.3 }, uG: { value: 2.2 }, uHeap: { value: 0 }, uW: { value: 0.01 },
    uColor: { value: new THREE.Color(0.9, 0.95, 0.96) }, uGain: { value: 1.05 },
  };
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 64), new THREE.ShaderMaterial({
    uniforms: streamU, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uH, uHeap, uW;
      varying vec2 vUv; varying float vY;
      void main() {
        vUv = uv;
        float y = mix(uHeap, uH, uv.y);
        vY = y;
        // narrow at the pour, a little wider as it falls and fans out
        float w = uW * (0.55 + 0.75 * (1.0 - uv.y));
        vec3 p = vec3((uv.x - 0.5) * w * 2.2, y, 0.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uH, uG, uGain;
      uniform vec3 uColor;
      varying vec2 vUv; varying float vY;
      float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      // one layer of round grains: columns across the stream, rows by release time (so they fall correctly)
      float grains(float x, float rel, float cols, float rows, float seed) {
        vec2 q = vec2(x * cols, rel * rows);
        q.x += 0.5 * mod(floor(q.y), 2.0);
        vec2 c = floor(q), f = fract(q) - 0.5;
        vec2 o = (vec2(hash12(c + seed), hash12(c + seed + 3.7)) - 0.5) * 0.5;
        float r = 0.22 + 0.16 * hash12(c + seed + 9.1);
        return step(0.35, hash12(c + seed + 1.3)) * smoothstep(r, r * 0.4, length(f - o)) * (0.6 + 0.4 * hash12(c + seed + 5.5));
      }
      void main() {
        float fallT = sqrt(max(0.0, 2.0 * (uH - vY) / uG));
        float rel = uTime - fallT;                 // when the grains here were released
        float x = (vUv.x - 0.5) * 2.2;             // across the stream
        // a slightly ragged silhouette that stays put (nothing blinks at the edges)
        float e1 = hash12(vec2(floor(vY * 160.0), 7.0)), e2 = hash12(vec2(floor(vY * 160.0) + 1.0, 7.0));
        float edge = 0.6 + 0.25 * mix(e1, e2, smoothstep(0.0, 1.0, fract(vY * 160.0)));
        float core = smoothstep(edge, edge * 0.1, abs(x));
        float g = max(grains(vUv.x, rel, 22.0, 2600.0, 0.0), grains(vUv.x, rel, 31.0, 3300.0, 17.0));
        float a = core * (0.42 + 0.5 * g);
        // the top runs out of frame; the foot runs right into the heap
        a *= smoothstep(1.0, 0.92, vUv.y);
        gl_FragColor = vec4(uColor * uGain * (0.8 + 0.35 * g), a);
      }`,
  }));
  stream.frustumCulled = false;
  stream.onBeforeRender = (r, sc, camera) => {
    // turn about the vertical to face the camera
    const wp = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);
    stream.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
    stream.updateMatrixWorld(true);
  };
  group.add(stream);
  const dummy = new THREE.Object3D();
  const TAN = Math.tan((33 * Math.PI) / 180);
  const P = { rate: 1100, H: 0.3, g: 2.2, hmax: 0.058, nmax: 3200, smin: 0.0036, sadd: 0.0036, spread: 0.018, stream: false };
  const hOf = (n) => P.hmax * Math.cbrt(clamp(n / P.nmax, 0, 1));
  const pose = (tau) => {
    const landed = Math.max(0, (tau - 0.33) * P.rate);
    const hNow = hOf(landed);
    const Rnow = hNow / TAN;
    cone.visible = hNow > 0.002;
    cone.scale.set(Rnow * 0.9, hNow * 0.9, Rnow * 0.9);
    cone.position.y = (hNow * 0.9) / 2;
    const counts = [0, 0, 0];
    const spawned = Math.min(N, Math.floor(tau * P.rate));
    streamU.uTime.value = tau; streamU.uH.value = P.H; streamU.uG.value = P.g;
    // The foot of the stream goes into the heap: the cone's tip is at 0.9 h, and the foot sits just deep enough below it
    // that the cone's slopes hide the ribbon's flat bottom edge (its grains reach 1.3 * 0.85 * uW each side there).
    // So the stream meets the pile, with no gap above the tip.
    const footHalf = 1.3 * 0.85 * P.spread * 0.5;
    streamU.uHeap.value = Math.max(0, hNow * 0.9 - footHalf * TAN * 1.2); streamU.uW.value = P.spread * 0.5;
    stream.visible = P.stream;
    for (let i = 0; i < spawned; i++) {
      const ti = i / P.rate;
      const age = tau - ti;
      const s = P.smin + Math.pow(hash1(i * 11 + 1), 2) * P.sadd;
      const hl = hOf(i);
      const Rl = hl / TAN;
      const fr = Math.sqrt(hash1(i * 11 + 2)) * 0.98;
      const th = hash1(i * 11 + 3) * Math.PI * 2;
      const ox = (hash1(i * 11 + 4) - 0.5) * P.spread, oz = (hash1(i * 11 + 5) - 0.5) * P.spread;
      const yLand = hl + s * 0.3;
      const tf = Math.sqrt((2 * Math.max(0, P.H - yLand)) / P.g);
      const e1 = hash1(i * 11 + 6) * 6.28, e2 = hash1(i * 11 + 7) * 6.28, e3 = hash1(i * 11 + 8) * 6.28;
      const sp = 1.2 + hash1(i * 11 + 9) * 2.2;
      let x, y, z, spin;
      if (age < tf) {
        if (P.stream) continue; // in the air: drawn by the stream ribbon
        x = ox * (1 + age * 1.5); z = oz * (1 + age * 1.5);
        y = P.H - 0.5 * P.g * age * age;
        spin = age;
      } else {
        const kk = easeOut(clamp((age - tf) / 0.3), 2);
        const fx = Math.cos(th) * fr * Rl, fz = Math.sin(th) * fr * Rl;
        const fy = Math.max(0, hl - fr * Rl * TAN) + s * 0.35;
        if (P.stream) {
          // settle in place: the grain rolls the last little way into its spot and grows in, no long slide
          const kIn = smooth((age - tf) / 0.25);
          const coneSurf = 0.9 * hNow - Math.hypot(fx, fz) * TAN;
          if (kIn >= 1 && fy + s * 1.3 < coneSurf) continue;
          dummy.position.set(fx * (0.85 + 0.15 * kIn), fy + s * 2.5 * (1 - kIn), fz * (0.85 + 0.15 * kIn));
          dummy.rotation.set(e1 + tf * sp, e2 + tf * sp * 0.7, e3);
          dummy.scale.setScalar(s * 1.15 * (0.3 + 0.7 * kIn));
          dummy.updateMatrix();
          const kind = i % KINDS;
          meshes[kind].setMatrixAt(counts[kind]++, dummy.matrix);
          continue;
        }
        // crystals are hidden only once the cone's surface has risen right over them (no popping)
        const coneSurf = 0.9 * hNow - Math.hypot(fx, fz) * TAN;
        if (kk >= 1 && fy + s * 1.3 < coneSurf) continue;
        x = lerp(ox * (1 + tf * 1.5), fx, kk); z = lerp(oz * (1 + tf * 1.5), fz, kk);
        y = lerp(yLand, fy, kk) + Math.sin(kk * Math.PI) * s * 1.2;
        spin = tf + 0.08 * kk;
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(e1 + spin * sp, e2 + spin * sp * 0.7, e3);
      dummy.scale.setScalar(s * 1.15);
      dummy.updateMatrix();
      const kind = i % KINDS;
      meshes[kind].setMatrixAt(counts[kind]++, dummy.matrix);
    }
    for (let q = 0; q < KINDS; q++) { meshes[q].count = counts[q]; meshes[q].instanceMatrix.needsUpdate = true; }
  };
  return { group, mesh, meshes, cone, pose, mat, P, backWorld, backU, stream, streamU };
}

function islandTerrain() {
  const S = 150, N = 240;
  const g = new THREE.PlaneGeometry(S, S, N, N);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = [];
  const coast = (a) => 47 + 3.5 * Math.sin(3 * a + 1) + 2.2 * Math.sin(7 * a + 2) + 1.2 * Math.sin(13 * a + 0.5);
  const hAt = (x, z) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    const rc = coast(a);
    const u = r / rc;
    let h;
    if (u < 0.3) h = 1.8;
    else if (u < 0.86) h = 1.8 - 1.2 * smooth((u - 0.3) / 0.56);
    else h = 0.6 - 3.6 * (u - 0.86);
    const n = Math.sin(x * 0.35) * Math.cos(z * 0.31) * 0.18 + Math.sin(x * 1.3 + z * 0.9) * 0.05;
    return h + (u > 0.3 && u < 0.85 ? n : n * 0.2);
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = hAt(x, z);
    p.setY(i, h);
    const r = Math.hypot(x, z), rc = coast(Math.atan2(z, x));
    const u = r / rc;
    // packed earth in the clearing, dark growth, pale sand at the shore; soft, noisy borders
    const wob = 0.03 * Math.sin(x * 0.9) * Math.cos(z * 0.7) + 0.02 * Math.sin(x * 2.1 + z * 1.7);
    const clearing = 1 - smooth((u + wob - 0.24) / 0.08);
    const sandK = smooth((0.66 - h + wob * 4) / 0.25);
    const veg = [0.035, 0.05, 0.04], earth = [0.19, 0.16, 0.125], sandC = [0.4, 0.37, 0.31];
    const n = 0.85 + 0.3 * hash1(i);
    const c = [0, 1, 2].map((k) => (veg[k] * (1 - sandK) + sandC[k] * sandK) * (1 - clearing) + earth[k] * clearing);
    col.push(c[0] * n, c[1] * n, c[2] * n);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = true;
  return { mesh: m, hAt, coast };
}

export async function seaStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x061416, 0.004);

  const env = studioEnv(film.renderer, [
    { pos: [0, 1.4, -8], size: [1.6, 1.6], color: [1, 0.96, 0.88], intensity: 7 },
    { pos: [0, -2.5, -7], size: [7, 1.2], color: [0.55, 0.75, 0.78], intensity: 0.9 },
    { pos: [3, 2.5, 6], size: [3, 3], color: [0.9, 0.92, 0.88], intensity: 0.7 },
  ], { top: [0.01, 0.025, 0.035], horizon: [0.05, 0.13, 0.14], bottom: [0.01, 0.02, 0.025] });
  scene.environment = env;
  scene.environmentIntensity = 1.0;

  // Shared sky uniforms (sky dome + sea).
  const U = {
    uMoonDir: { value: new THREE.Vector3(0, 0.15, -1).normalize() },
    uHorizon: { value: HORIZON.clone() }, uZenith: { value: ZENITH.clone() },
    uMoonCol: { value: MOONCOL.clone() }, uMoonR: { value: 0.08 }, uHalo: { value: 0.05 },
  };
  const skyU = { ...U };
  const seaU = {
    ...U,
    uTime: { value: 0 }, uGlint: { value: 1.6 }, uPathW: { value: 0.05 }, uSparkF: { value: 2.2 }, uSparkGain: { value: 140 }, uFogDist: { value: 900 }, uChop: { value: 1 },
    uWater: { value: new THREE.Color(0.001, 0.005, 0.007) }, uFogCol: { value: HORIZON.clone() },
  };

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMaterial(skyU));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  // Stars: fixed directions, drawn at infinity.
  const NST = 4000;
  const sp = new Float32Array(NST * 3), sc = new Float32Array(NST * 3);
  for (let i = 0; i < NST; i++) {
    const a = hash1(i * 5 + 1) * Math.PI * 2, y = 0.03 + Math.pow(hash1(i * 5 + 2), 0.8) * 0.97;
    const r = Math.sqrt(1 - y * y);
    sp[i * 3] = Math.cos(a) * r * 1400; sp[i * 3 + 1] = y * 1400; sp[i * 3 + 2] = Math.sin(a) * r * 1400;
    const b = Math.pow(hash1(i * 5 + 3), 4) * 2.0 + 0.1;
    sc[i * 3] = b * 0.9; sc[i * 3 + 1] = b * 0.97; sc[i * 3 + 2] = b;
  }
  const stGeo = new THREE.BufferGeometry();
  stGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  stGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const stars = new THREE.Points(stGeo, new THREE.PointsMaterial({ size: 2.3, sizeAttenuation: false, vertexColors: true, map: glowSprite(32), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  stars.renderOrder = -9; stars.frustumCulled = false;
  scene.add(stars);

  // The moon: the museum photo on a disc, always facing the camera, placed at "infinity".
  const moonIm = await loadImage(`${TEX.base}tex/moon.jpg`);
  const moonTex = new THREE.Texture(moonIm);
  moonTex.colorSpace = THREE.SRGBColorSpace; moonTex.anisotropy = 8; moonTex.needsUpdate = true;
  const moonMat = new THREE.MeshBasicMaterial({ map: moonTex, alphaMap: discAlpha(), transparent: true, depthWrite: false, fog: false, color: MOONCOL.clone().multiplyScalar(1.9) });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMat);
  moon.renderOrder = -8; moon.frustumCulled = false;
  scene.add(moon);
  // Keep the moon sharp. At "infinity", far past the focus, the depth of field smeared its bright craters into rings
  // of dots and softened the photo, so it looked low-resolution. A stand-in disc draws only into the blur's depth pass
  // (in the picture it writes nothing). It is pulled toward the lens to the focus distance, so it covers exactly the
  // moon's pixels and marks them as in focus. Everything else keeps its blur. (The outro's moon does the same.)
  const moonFocus = new THREE.Mesh(new THREE.CircleGeometry(0.496, 96), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  moonFocus.frustumCulled = false;
  {
    const lens = new THREE.Vector3(), view = new THREE.Vector3(), toLens = new THREE.Matrix4(), shrink = new THREE.Matrix4(), back = new THREE.Matrix4();
    moonFocus.onBeforeRender = (r, sc, camera) => {
      lens.setFromMatrixPosition(camera.matrixWorld);
      view.setFromMatrixPosition(moon.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      const k = Math.min(1, film.bokeh.uniforms.focus.value / Math.max(1e-3, -view.z));
      // scale about the lens: every point keeps its place on screen and moves to the focus distance
      toLens.makeTranslation(-lens.x, -lens.y, -lens.z); shrink.makeScale(k, k, k); back.makeTranslation(lens.x, lens.y, lens.z);
      moonFocus.matrixWorld.copy(moon.matrixWorld).premultiply(toLens).premultiply(shrink).premultiply(back);
    };
  }
  moon.add(moonFocus);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowSprite(256, [[0, 1], [0.25, 0.5], [0.5, 0.12], [1, 0]]), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.16, 0.19, 0.19) }));
  halo.renderOrder = -7; halo.frustumCulled = false;
  scene.add(halo);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), seaMaterial(seaU));
  sea.rotation.x = -Math.PI / 2;
  sea.scale.set(7000, 7000, 1);
  sea.frustumCulled = false;
  sea.receiveShadow = false;
  scene.add(sea);

  // Lights.
  const moonLight = new THREE.DirectionalLight(0xdce8e6, 2.2);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.02;
  scene.add(moonLight, moonLight.target);
  const hemi = new THREE.HemisphereLight(0x3d6e74, 0x0a0d0c, 0.55);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xcfd8d2, 0.0);
  scene.add(fill, fill.target);
  const warm = new THREE.PointLight(0xffe2b8, 0, 40, 1.6);
  scene.add(warm);

  // Cowrie on its string.
  const cowrie = hangingCowrie({ length: 0.26, cord: 2.5, env: cowrieEnv(film.renderer) });
  scene.add(cowrie.group);

  // Salt pours onto a slab of wet black rock at the waterline.
  const salt = saltPour(env);
  const rockTex = await raiTextures();
  const rockN = rockTex.normal.clone(); rockN.repeat.set(7, 7); rockN.needsUpdate = true;
  const rockGeo = new THREE.PlaneGeometry(3, 3, 180, 180);
  rockGeo.rotateX(-Math.PI / 2);
  {
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      const lump = (Math.sin(x * 7.1 + 1.3) * Math.cos(z * 6.3) * 0.012 + Math.sin(x * 19 + z * 13) * 0.003) * Math.min(1, r / 0.25);
      p.setY(i, lump - Math.max(0, r - 0.9) * 0.1);
    }
    rockGeo.computeVertexNormals();
  }
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.86, metalness: 0, normalMap: rockN, normalScale: new THREE.Vector2(0.28, 0.28), envMap: env, envMapIntensity: 0.14 });
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.receiveShadow = true;
  salt.group.add(rock);
  scene.add(salt.group);

  // Stone money.
  const stoneMat = await raiMaterial({ tint: 0xffe9cc });
  const canoeStone = new THREE.Mesh(raiGeometry({ R: 1.0, rh: 0.23, th: 0.32, te: 0.17, seed: 5 }), stoneMat);
  canoeStone.rotation.x = Math.PI / 2;
  canoeStone.castShadow = true;
  const boat = makeCanoe({ stone: canoeStone });
  boat.group.position.copy(SETS.canoe);
  scene.add(boat.group);

  // The shore stone: the biggest, alone on the beach.
  const beach = new THREE.Group();
  beach.position.copy(SETS.beach);
  // Sand from far behind the camera up to just past the stone, then down into the water.
  const sandGeo = new THREE.PlaneGeometry(160, 100, 200, 140);
  sandGeo.rotateX(-Math.PI / 2);
  sandGeo.translate(0, 0, -40);
  {
    const p = sandGeo.attributes.position;
    const col = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const shore = 3.5 + Math.sin(x * 0.21) * 1.2 + Math.sin(x * 0.07 + 1) * 2.0;
      const h = 0.3 - 0.95 * smooth((z - shore) / 7) + Math.sin(x * 0.9 + z * 0.3) * Math.cos(z * 1.1) * 0.02;
      p.setY(i, h);
      const wet = smooth((z - shore + 2) / 3);
      const n = 0.85 + 0.3 * hash1(i * 3 + 1);
      col.push((0.14 - 0.06 * wet) * n, (0.135 - 0.055 * wet) * n, (0.125 - 0.045 * wet) * n);
    }
    sandGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sandGeo.computeVertexNormals();
  }
  const sand = new THREE.Mesh(sandGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  sand.receiveShadow = true;
  beach.add(sand);
  const heroMat = await raiMaterial({ tint: 0xffefd6 });
  const hero = new THREE.Mesh(raiGeometry({ R: 2.2, rh: 0.56, th: 0.6, te: 0.34, seed: 21, segs: 160 }), heroMat);
  hero.rotation.x = Math.PI / 2;
  hero.position.set(0, 2.1, 0);
  hero.castShadow = true; hero.receiveShadow = true;
  beach.add(hero);
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x050807, roughness: 0.9, side: THREE.DoubleSide });
  const beachPalms = [];
  for (const [x, z, hgt, lean, seed] of [[-10.5, 6, 8.6, -0.22, 3], [11, 5, 7.6, 0.26, 7], [-13, -3, 9.5, -0.12, 9]]) {
    const m = new THREE.Mesh(palmGeometry({ height: hgt, lean, seed }), palmMat);
    m.position.set(x, 0.3, z);
    m.castShadow = true;
    beach.add(m);
    beachPalms.push(m);
  }
  scene.add(beach);

  // The island and its stone bank.
  const island = new THREE.Group();
  island.position.copy(SETS.island);
  const terr = islandTerrain();
  island.add(terr.mesh);
  const RING_R = 10.5, NR = 11;
  const ring = [];
  for (let i = 0; i < NR; i++) {
    const phi = (i / NR) * Math.PI * 2 + (hash1(i * 17 + 3) - 0.5) * 0.18;
    const R = 1.35 + hash1(i * 17 + 4) * 0.95;
    const mat = stoneMat.clone();
    mat.emissive = new THREE.Color(1.0, 0.86, 0.62);
    mat.emissiveIntensity = 0;
    const m = new THREE.Mesh(raiGeometry({ R, rh: R * 0.22, th: R * 0.32, te: R * 0.16, seed: 40 + i }), mat);
    const lean = (18 + hash1(i * 17 + 5) * 14) * Math.PI / 180;
    const radial = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
    const n = radial.clone().multiplyScalar(-Math.cos(lean)).add(new THREE.Vector3(0, Math.sin(lean), 0)).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const ground = terr.hAt(radial.x * RING_R, radial.z * RING_R);
    m.position.set(radial.x * RING_R, ground + R * Math.cos(lean) * 0.93, radial.z * RING_R);
    m.castShadow = true; m.receiveShadow = true;
    island.add(m);
    // top of the stone: centre + R * (in-plane up)
    const upIn = new THREE.Vector3(0, 1, 0).sub(n.clone().multiplyScalar(n.y)).normalize();
    const top = m.position.clone().addScaledVector(upIn, R * 0.98);
    ring.push({ mesh: m, mat, R, top, phi });
  }
  const palms = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + hash1(i * 7 + 1) * 0.3;
    const rc = terr.coast(a);
    const r = lerp(17, rc - 7, hash1(i * 7 + 2));
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const m = new THREE.Mesh(palmGeometry({ height: 7 + hash1(i * 7 + 3) * 5, lean: 0.1 + hash1(i * 7 + 4) * 0.25, seed: 100 + i }), palmMat);
    m.position.set(x, terr.hAt(x, z) - 0.1, z);
    m.rotation.y = hash1(i * 7 + 5) * 6.28;
    m.castShadow = true;
    island.add(m);
    palms.push(m);
  }
  // Low bush, as dark lumps.
  const bushGeo = new THREE.IcosahedronGeometry(1, 1);
  const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: 0x0b140f, roughness: 0.95, flatShading: true }), 90);
  {
    const d = new THREE.Object3D();
    for (let i = 0; i < 90; i++) {
      const a = hash1(i * 3 + 11) * Math.PI * 2;
      const r = lerp(19, terr.coast(a) - 6, Math.sqrt(hash1(i * 3 + 12)));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const s = 0.8 + hash1(i * 3 + 13) * 1.6;
      d.position.set(x, terr.hAt(x, z) + s * 0.3, z);
      d.scale.set(s, s * 0.7, s);
      d.rotation.set(0, hash1(i) * 6, 0);
      d.updateMatrix();
      bushes.setMatrixAt(i, d.matrix);
    }
    bushes.castShadow = true; bushes.receiveShadow = true;
  }
  island.add(bushes);
  // The ledger: a cord of light strung from stone to stone around the ring. Each "every" carries it on
  // to the next stones; on the last it closes the circle round the island. A lamp lights on each stone it reaches.
  const PAIRS = [
    [[0, 1], [1, 2]],
    [[2, 3], [3, 4], [4, 5]],
    [[5, 6], [6, 7], [7, 8]],
    [[8, 9], [9, 10], [10, 0]],
  ];
  const threadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.52).multiplyScalar(1.8), fog: false });
  const threads = [];
  const TSEG = 48, TRAD = 5;
  PAIRS.forEach((group, gi) => group.forEach(([a, b], k) => {
    const A = ring[a].top, B = ring[b].top;
    // a cord hanging between two posts: sags in the middle
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const p = A.clone().lerp(B, u);
      p.y -= Math.sin(Math.PI * u) * A.distanceTo(B) * 0.09;
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, TSEG, 0.026, TRAD, false);
    const mesh = new THREE.Mesh(geo, threadMat.clone());
    mesh.frustumCulled = false;
    island.add(mesh);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.9, 0.7).multiplyScalar(3.5), fog: false }));
    island.add(head);
    threads.push({ mesh, geo, curve, head, group: gi, k, a, b });
  }));
  // a small oil-lamp flame on top of each stone
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.36).multiplyScalar(3), fog: false });
  const lamps = ring.map((r) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), lampMat.clone());
    m.scale.set(1, 1.6, 1);
    m.position.copy(r.top).add(new THREE.Vector3(0, 0.14, 0));
    island.add(m);
    return m;
  });
  scene.add(island);

  const tmp = new THREE.Vector3();
  const S = {
    scene, env, sky, stars, moon, halo, sea, seaU, skyU, moonLight, hemi, fill, warm,
    cowrie, salt, rock, boat, canoeStone, beach, hero, beachPalms, island, terr, ring, palms, threads, SETS,
    fx: { bloom: 0.4, threshold: 1.0, bloomRadius: 0.5, grain: 0.05, vignette: 0.5, tint: [0.97, 1.0, 1.0], contrast: 1.06 },
    // Moon as seen from the camera: azimuth from -Z toward +X, elevation, angular diameter (degrees).
    moonAz: 0, moonEl: 8, moonSize: 10, moonGain: 1.3, pathW: null, lightFromMoon: true,
    moonDir(az = S.moonAz, el = S.moonEl) {
      const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
      return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    },
    // Link sky, moon and sea to the camera; call after the camera is placed.
    follow(cam) {
      const d = S.moonDir();
      U.uMoonDir.value.copy(d);
      const r = ((S.moonSize / 2) * Math.PI) / 180;
      U.uMoonR.value = r;
      seaU.uPathW.value = S.pathW ?? Math.min(0.1, Math.max(0.03, r * 0.7));
      sky.position.copy(cam.position);
      stars.position.copy(cam.position);
      const D = 1200;
      moon.position.copy(cam.position).addScaledVector(d, D);
      moon.lookAt(cam.position);
      const size = 2 * D * Math.tan(r);
      moon.scale.set(size, size, 1);
      halo.position.copy(cam.position).addScaledVector(d, D + 10);
      halo.lookAt(cam.position);
      halo.scale.set(size * 4.5, size * 4.5, 1);
      moonMat.color.copy(MOONCOL).multiplyScalar(S.moonGain);
      sea.position.set(cam.position.x, 0, cam.position.z);
      if (S.lightFromMoon) moonLight.position.copy(moonLight.target.position).addScaledVector(d, 120);
    },
    // Shadow camera around a point, of half-size h.
    shadowAround(p, h) {
      moonLight.target.position.copy(p);
      const c = moonLight.shadow.camera;
      if (c.right !== h) { c.left = -h; c.right = h; c.top = h; c.bottom = -h; c.near = 1; c.far = 400; c.updateProjectionMatrix(); }
    },
    // Draw the ledger threads: each group of threads starts at its "every".
    ledger(t, hits, dur = 0.2) {
      let lit = 0;
      const reached = new Array(ring.length).fill(-1); // time each stone's lamp lit
      for (const th of threads) {
        const t0 = hits[th.group] + th.k * dur;
        const k = clamp((t - t0) / dur);
        const drawn = Math.floor(k * TSEG) * TRAD * 6;
        th.geo.setDrawRange(0, drawn);
        th.mesh.visible = k > 0;
        const glow = k >= 1 ? 0.8 + 0.2 * Math.sin(t * 3 + th.a) : 1;
        th.mesh.material.color.setRGB(1.0, 0.8, 0.52).multiplyScalar(1.8 * glow);
        th.head.visible = k > 0 && k < 1;
        if (th.head.visible) th.head.position.copy(th.curve.getPoint(k));
        if (k > 0 && (reached[th.a] < 0 || t0 < reached[th.a])) reached[th.a] = t0;
        if (k >= 1) { lit++; const tb = t0 + dur; if (reached[th.b] < 0 || tb < reached[th.b]) reached[th.b] = tb; }
      }
      ring.forEach((r, i) => {
        const on = reached[i] >= 0 ? clamp((t - reached[i]) / 0.15) : 0;
        r.glow = on;
        r.mat.emissiveIntensity = on * 0.1;
        lamps[i].visible = on > 0;
        lamps[i].scale.set(on, on * (1.5 + 0.2 * Math.sin(t * 17 + i * 3)), on);
      });
      return lit;
    },
    update(ctx) {
      const t = ctx.t;
      seaU.uTime.value = t;
      seaU.uGlint.value = 1.6; seaU.uChop.value = 1; seaU.uSparkF.value = 2.2; seaU.uSparkGain.value = 140; seaU.uFogDist.value = 900;
      U.uHalo.value = 0.05;
      scene.fog.density = 0.004;
      S.moonAz = 0; S.moonEl = 8; S.moonSize = 10; S.moonGain = 1.3; S.pathW = null; S.lightFromMoon = true;
      moon.visible = true; halo.visible = true; stars.visible = true; sea.visible = true;
      moonLight.intensity = 2.2; moonLight.color.set(0xdce8e6); moonLight.castShadow = true;
      S.shadowAround(tmp.set(0, 0, 0), 60);
      hemi.intensity = 0.55;
      fill.intensity = 0; fill.color.set(0xcfd8d2); fill.position.set(0, 5, 10); fill.target.position.set(0, 0, 0);
      warm.intensity = 0;
      cowrie.group.visible = false; cowrie.holder.rotation.set(0, 0, 0); cowrie.spinner.rotation.set(0, 0, 0);
      salt.group.visible = false;
      rock.visible = true;
      boat.group.visible = false;
      beach.visible = false;
      hero.rotation.set(Math.PI / 2, 0, 0, 'XYZ');
      island.visible = false;
      for (const th of threads) { th.mesh.visible = false; th.head.visible = false; }
      for (const l of lamps) l.visible = false;
      for (const r of ring) { r.glow = 0; r.mat.emissiveIntensity = 0; }
      scene.environmentIntensity = 1.0;
    },
  };
  return S;
}
