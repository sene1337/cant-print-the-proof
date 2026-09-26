// VERSE 1 earth stage: a cut through the island's ground, strata going down into the dark,
// and a quartz vein with gold in it. Moonlight at the top; the gold's own glow at the bottom.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Dust } from '../props/dust.js';
import { clamp, hash1 } from '../util.js';
import { raiTextures } from '../props/verse1-rai.js';
import { normalFromHeight } from '../tex.js';

const COMMON = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  float fbm3(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  float surfY(float x) { return 0.18 * sin(x * 0.7 + 1.0) + 0.1 * sin(x * 2.3) + 0.05 * sin(x * 5.1); }
  float veinY(float x) { return -5.4 + 0.3 * x + 0.3 * sin(x * 0.9 + 0.4) + 0.1 * sin(x * 3.1); }
  // Large-scale relief of the cut face (metres toward the camera): rock stands proud of the soil.
  float relief(vec2 p) {
    float d = surfY(p.x) - p.y;
    if (d < 0.0) return 0.0;
    float hard = smoothstep(1.4, 2.4, d);
    float dv = p.y - veinY(p.x);
    float nearVein = 1.0 - 0.9 * exp(-dv * dv / 0.35); // the seam sits in a flatter face, so the gold sits on it
    return ((fbm3(p * 0.45) - 0.5) * 0.5 + hard * (0.15 + 0.35 * fbm3(p * 1.2 + 4.0))) * smoothstep(0.0, 0.3, d) * nearVein;
  }
`;

const ROCK = /* glsl */ `
  uniform sampler2D uStone, uStoneN;
  float ridged(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.07 + 11.3; a *= 0.5; }
    return s;
  }
  // Voronoi: F1 distance, edge distance (F2 - F1), cell id.
  vec3 voro(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 9.0, d2 = 9.0, id = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; id = hash12(i + g + 3.1); } else if (d < d2) { d2 = d; }
    }
    return vec3(d1, d2 - d1, id);
  }
  // A family of roughly parallel fractures (joints) that run in segments and stop, as in a real cliff face.
  float joints(vec2 p, float ang, float spacing, float width, float segLen, float keep, float seed) {
    vec2 n = vec2(cos(ang), sin(ang)), t = vec2(-n.y, n.x);
    float u = dot(p, n) / spacing + (fbm3(p * 0.8 + seed) - 0.5) * 0.3;
    float k = floor(u + 0.5);
    float dist = abs(u - k) * spacing;
    float seg = floor(dot(p, t) / segLen + hash12(vec2(k, seed)) * 3.0);
    float on = step(1.0 - keep, hash12(vec2(k * 1.7 + seg * 13.1, seed + 5.0)));
    return on * smoothstep(width, width * 0.2, dist);
  }
  // Albedo, height, wetness, gold and photo normal of the cut face at p. The surface detail comes from a
  // real stone photo; the structure (soil, clay, broken rock, bedrock, joints, the vein) is procedural.
  void rock(vec2 p, out float h, out vec3 alb, out float wet, out float gold, out vec2 nt) {
    float d = surfY(p.x) - p.y;
    float n = fbm(p * 1.9 + 3.0);
    float dd = d + (fbm3(vec2(p.x * 0.22, 3.0)) - 0.5) * 1.0 + (n - 0.5) * 0.45;
    vec2 uvS = p * vec2(0.62, 1.0);
    vec2 uA = uvS * 0.8 + vec2(0.13, 0.41), uB = uvS * 2.1 + vec2(0.57, 0.19);
    float lum = dot(mix(texture2D(uStone, uA).rgb, texture2D(uStone, uB).rgb, 0.35), vec3(0.3, 0.59, 0.11));
    nt = (texture2D(uStoneN, uA).xy * 2.0 - 1.0) * 0.6 + (texture2D(uStoneN, uB).xy * 2.0 - 1.0) * 0.4;
    wet = 0.0; gold = 0.0;
    // Soil profile: turf and topsoil, then clay, then rock, blending over ragged transition zones.
    float tSoil = smoothstep(0.3, 0.7, dd + (n - 0.5) * 0.35);
    float tRock = smoothstep(1.3, 1.95, dd + (n - 0.5) * 0.6);
    // Rock: many thin beds. Harder beds stand proud (differential weathering) and throw a shadow under
    // the raking light; beds are rust-stained near the top and fresh blue-grey at depth.
    float bc = dd * 2.7 + 0.5 * sin(dd * 1.3) + (fbm3(vec2(p.x * 0.35, 11.0)) - 0.5) * 0.8;
    float bid = floor(bc), bf = fract(bc);
    float hard = hash12(vec2(bid, 3.0));
    float parting = smoothstep(0.07, 0.0, min(bf, 1.0 - bf));
    float fresh = smoothstep(1.9, 3.6, dd);
    vec3 weatheredC = mix(vec3(0.2, 0.13, 0.075), vec3(0.3, 0.21, 0.13), hard);
    vec3 freshC = mix(vec3(0.065, 0.068, 0.078), vec3(0.14, 0.138, 0.14), hard);
    vec3 rockC = mix(weatheredC, freshC, fresh) * (0.35 + 1.2 * lum);
    // short joints that stop at the bedding planes
    float jx = p.x * 0.8 + (fbm3(p * 0.9 + 4.0) - 0.5) * 0.7;
    float jk = floor(jx + 0.5);
    float joint = step(0.55, hash12(vec2(jk, bid))) * smoothstep(0.05, 0.012, abs(jx - jk));
    rockC *= (1.0 - parting * 0.55) * (1.0 - joint * 0.8);
    float hRock = hard * 0.35 + 0.12 * sin(bf * 3.14159) - parting * 0.25 - joint * 0.45 + 0.25 * ridged(p * 1.4);
    // clay: rusty orange-brown with grey-green mottles, fine bedding, and gravel of many sizes
    float mott = fbm(p * 2.6 + 5.0);
    float gley = smoothstep(0.58, 0.72, fbm(p * 1.7 + 13.0));
    float lamC = 0.5 + 0.5 * sin((p.y + (fbm3(p * 0.8) - 0.5) * 0.6) * 38.0);
    vec3 clayC = mix(vec3(0.16, 0.075, 0.035), vec3(0.3, 0.15, 0.07), mott);
    clayC = mix(clayC, vec3(0.2, 0.19, 0.15), gley * 0.7);
    clayC *= (0.62 + 0.75 * lum) * (0.9 + 0.1 * lamC);
    vec3 v = voro(p * 5.5 + 2.0);
    float stone = step(0.8, v.z) * smoothstep(0.34, 0.16, v.x + (vnoise(p * 24.0) - 0.5) * 0.14);
    vec3 v2 = voro(p * 11.0 + 7.0 + (vec2(fbm3(p * 4.0), fbm3(p * 4.0 + 9.0)) - 0.5) * 1.2);
    float grit = step(0.86, v2.z) * smoothstep(0.26, 0.1, v2.x + (vnoise(p * 60.0) - 0.5) * 0.1);
    vec3 stoneC = mix(vec3(0.12, 0.115, 0.11), vec3(0.32, 0.27, 0.2), hash12(vec2(v.z * 91.0, 1.0))) * (0.5 + lum);
    clayC = mix(clayC, stoneC, stone);
    clayC = mix(clayC, vec3(0.22, 0.2, 0.17) * (0.6 + lum), grit * 0.8);
    float hClay = n * 0.35 + mott * 0.1 + lamC * 0.04 + stone * 0.45 + grit * 0.15;
    // topsoil: near-black crumb with small aggregates
    vec3 v3 = voro(p * 7.0 + 3.0 + (vec2(fbm3(p * 3.0), fbm3(p * 3.0 + 5.0)) - 0.5) * 0.9);
    float clod = smoothstep(0.015, 0.09, v3.y); // 0 in the cracks between clods
    vec3 soilC = vec3(0.045, 0.034, 0.025) * (0.5 + 0.9 * n) * (0.65 + 0.7 * lum) * (0.45 + 0.6 * clod) * (0.85 + 0.3 * v3.z);
    float hSoil = n * 0.3 + clod * 0.22;
    alb = mix(mix(soilC, clayC, tSoil), rockC, tRock);
    h = mix(mix(hSoil, hClay, tSoil), hRock, tRock);
    nt *= mix(mix(0.7, 0.9, tSoil), 1.0, tRock);
    wet = tRock * fresh * (0.35 + joint * 0.5 + parting * 0.3);
    // Roots hang down from the turf into the clay.
    if (d < 1.1 && d > 0.0) {
      float rx = p.x * 3.2 + fbm(vec2(p.x * 1.5, p.y * 2.5)) * 3.0 + p.y * 0.5;
      float stripe = floor(rx / 3.14159);
      float has = step(0.5, hash12(vec2(stripe, 7.0)));
      float line = abs(fract(rx / 3.14159) - 0.5);
      float thick = 0.03 * (1.0 - d / 1.1);
      float root = has * smoothstep(thick, thick * 0.3, line);
      alb = mix(alb, vec3(0.13, 0.095, 0.065), root * 0.85);
      h += root * 0.15;
    }
    // The vein: a seam of milky quartz carrying gold, with a dark contact along its edges.
    float vy = veinY(p.x);
    float vw = 0.07 + 0.04 * sin(p.x * 1.7 + 1.0) + 0.04 * fbm(p * 3.0);
    float vd = abs(p.y - vy + (fbm(p * 2.2) - 0.5) * 0.16);
    float inV = smoothstep(vw, vw - 0.025, vd);
    float edge = smoothstep(vw + 0.06, vw, vd) * (1.0 - inV);
    alb *= 1.0 - 0.6 * edge;
    if (inV > 0.0) {
      vec3 q = vec3(0.55, 0.53, 0.5) * (0.45 + 0.8 * lum);
      alb = mix(alb, q, inV);
      h = mix(h, 0.7 + ridged(p * 8.0) * 0.3, inV);
      gold = smoothstep(0.62, 0.8, fbm(p * 12.0 + 3.3)) * inV;
      wet = mix(wet, 0.9, inV);
    }
  }
`;

function wallMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `${COMMON}
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec4 w0 = modelMatrix * vec4(position, 1.0);
        vec2 p = w0.xy;
        float e = 0.05;
        float r0 = relief(p), rx = relief(p + vec2(e, 0.0)), ry = relief(p + vec2(0.0, e));
        vec4 w = w0 + vec4(0.0, 0.0, r0, 0.0);
        vW = w.xyz;
        vN = normalize(vec3(-(rx - r0) / e, -(ry - r0) / e, 1.0));
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `${COMMON}${ROCK}
      uniform float uTime, uGlow, uFlare, uLamp;
      uniform vec3 uNugget;
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec2 p = vW.xy;
        float sy = surfY(p.x);
        if (p.y > sy + 0.02) {
          // the night above the ground line, with the island's grass and scrub in silhouette
          float bush = max(0.0, fbm3(vec2(p.x * 0.6, 7.0)) - 0.45) * 1.1 + max(0.0, fbm3(vec2(p.x * 2.4, 2.0)) - 0.5) * 0.35;
          // tapered grass blades, each leaning its own way
          float gx = p.x * 34.0 + (p.y - sy) * (hash12(vec2(floor(p.x * 34.0), 9.0)) - 0.5) * 30.0;
          float gf = fract(gx);
          float blades = 0.13 * pow(hash12(vec2(floor(gx), 3.0)), 2.0) * pow(max(0.0, 1.0 - abs(gf - 0.5) * 2.0), 1.4);
          vec3 sky = mix(vec3(0.02, 0.055, 0.065), vec3(0.002, 0.006, 0.01), clamp((p.y - sy) / 3.0, 0.0, 1.0));
          float sil = step(p.y - sy, max(bush, blades));
          gl_FragColor = vec4(mix(sky, vec3(0.004, 0.006, 0.005), sil), 1.0);
          return;
        }
        float h, wet, gold; vec3 alb; vec2 nt;
        rock(p, h, alb, wet, gold, nt);
        // Fine normal from the height's screen derivatives, bent around the geometric normal.
        vec2 dpx = dFdx(p), dpy = dFdy(p);
        float hx = dFdx(h), hy = dFdy(h);
        float det = dpx.x * dpy.y - dpx.y * dpy.x;
        vec2 grad = abs(det) > 1e-12 ? vec2(hx * dpy.y - hy * dpx.y, hy * dpx.x - hx * dpy.x) / det : vec2(0.0);
        grad = clamp(grad, -14.0, 14.0);
        vec3 N = normalize(vN + vec3(-grad.x * 0.06 + nt.x * 0.55, -grad.y * 0.06 + nt.y * 0.55, 0.0));
        vec3 V = normalize(cameraPosition - vW);
        float depth = sy - p.y;
        // Moonlight spills into the top of the cut and dies with depth.
        float moonAmt = exp(-depth * 0.6);
        vec3 Lm = normalize(vec3(-0.35, 0.85, 0.4));
        vec3 col = alb * vec3(0.45, 0.62, 0.68) * max(dot(N, Lm), 0.0) * 1.7 * moonAmt;
        // A raking lamp from the upper left travels down with us and pulls the relief out of the rock.
        vec3 lampP = cameraPosition + vec3(-2.8, 1.8, -1.6);
        vec3 Ll = lampP - vW; float dl = length(Ll); Ll /= dl;
        float lamp = uLamp / (1.0 + dl * dl * 0.05);
        col += alb * vec3(1.0, 0.83, 0.64) * max(dot(N, Ll), 0.0) * lamp;
        vec3 Hl = normalize(Ll + V);
        col += vec3(1.0, 0.88, 0.72) * pow(max(dot(N, Hl), 0.0), 40.0) * wet * lamp * 0.3;
        // Cavities stay dark.
        col *= mix(0.3, 1.0, smoothstep(-0.25, 0.45, h));
        col += alb * vec3(0.025, 0.03, 0.035);
        // The gold's glow lights the rock around the vein.
        vec3 toN = uNugget - vW;
        float dn = length(toN);
        vec3 Ln = toN / dn;
        float fall = uGlow / (1.0 + dn * dn * 1.2);
        col += alb * vec3(1.0, 0.6, 0.22) * max(dot(N, Ln), 0.0) * fall * 2.4;
        vec3 Hh = normalize(Ln + V);
        col += vec3(1.0, 0.7, 0.35) * pow(max(dot(N, Hh), 0.0), 40.0) * fall * wet * 0.8;
        // Gold flecks shine on their own.
        float tw = 0.75 + 0.25 * sin(uTime * 3.0 + p.x * 40.0 + p.y * 23.0);
        col += vec3(1.0, 0.68, 0.22) * gold * (0.3 + uGlow * 0.55 + uFlare * 2.0 * exp(-dn * 0.7)) * tw;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function nuggetGeometry(seed = 3) {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let r = 1;
    for (let k = 1; k <= 7; k++) {
      const a = hash1(seed * 31 + k) * 6.28, b = hash1(seed * 31 + k + 9) * 6.28;
      r += (0.3 / Math.pow(k, 0.85)) * Math.sin(n.x * (k * 2.3) + a) * Math.cos(n.y * (k * 1.9) + b) * Math.sin(n.z * (k * 2.6) + a * 0.5);
    }
    // knobs and pits
    for (let k = 0; k < 9; k++) {
      const d = new THREE.Vector3(hash1(seed * 7 + k * 3) - 0.5, hash1(seed * 7 + k * 3 + 1) - 0.5, hash1(seed * 7 + k * 3 + 2) - 0.5).normalize();
      const dd = n.dot(d);
      r += (k % 3 === 0 ? -0.12 : 0.1) * Math.pow(Math.max(0, dd), 18);
    }
    v.copy(n).multiplyScalar(r);
    v.x *= 1.35; v.y *= 0.8;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export async function earthStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 5, 3], size: [4, 2], color: [1, 0.85, 0.6], intensity: 2.5 },
    { pos: [-5, 1, 2], size: [0.6, 4], color: [1, 0.7, 0.4], intensity: 3 },
    { pos: [4, -1, 3], size: [3, 1], color: [1, 0.6, 0.25], intensity: 2 },
  ], { top: [0.2, 0.14, 0.08], horizon: [0.08, 0.05, 0.025], bottom: [0.02, 0.012, 0.006] });

  const stoneTex = await raiTextures();
  const U = {
    uStone: { value: stoneTex.color }, uStoneN: { value: stoneTex.normal },
    uTime: { value: 0 }, uGlow: { value: 1 }, uFlare: { value: 0 }, uLamp: { value: 1.3 },
    uNugget: { value: new THREE.Vector3(0.7, -5, 0.15) },
  };
  // The cut face: displaced in the vertex shader, so it has real relief and parallax as the camera sinks.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 24, 240, 144), wallMaterial(U));
  wall.position.set(0, -8, 0);
  wall.frustumCulled = false;
  scene.add(wall);

  const veinY = (x) => -5.4 + 0.3 * x + 0.3 * Math.sin(x * 0.9 + 0.4) + 0.1 * Math.sin(x * 3.1);
  const nx = 0.7;
  const nuggetPos = new THREE.Vector3(nx, veinY(nx) + 0.02, 0.12);
  U.uNugget.value.copy(nuggetPos);

  // A hammered, pitted skin for the nugget.
  const pit = document.createElement('canvas');
  pit.width = pit.height = 256;
  {
    const g = pit.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = hash1(i * 5 + 1) * 256, y = hash1(i * 5 + 2) * 256, r = 2 + Math.pow(hash1(i * 5 + 3), 2) * 10;
      const v = hash1(i * 5 + 4) < 0.6 ? 40 : 200;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.5)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const pitN = normalFromHeight(pit, 2.2, 1.2);
  pitN.wrapS = pitN.wrapT = THREE.RepeatWrapping;
  pitN.repeat.set(3, 2);
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.76, 0.33), metalness: 1, roughness: 0.3, envMapIntensity: 1.5,
    normalMap: pitN, normalScale: new THREE.Vector2(1.2, 1.2),
    emissive: new THREE.Color(1.0, 0.55, 0.15), emissiveIntensity: 0.03,
  });
  const nugget = new THREE.Mesh(nuggetGeometry(3), goldMat);
  nugget.position.copy(nuggetPos);
  nugget.scale.setScalar(0.2);
  scene.add(nugget);
  // Smaller grains along the vein.
  const grainMat = goldMat.clone();
  grainMat.emissiveIntensity = 0.12;
  const grains = new THREE.InstancedMesh(nuggetGeometry(7), grainMat, 40);
  {
    const d = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const x = nx + (hash1(i * 3 + 1) - 0.5) * 7;
      d.position.set(x, veinY(x) + (hash1(i * 3 + 2) - 0.5) * 0.3, 0.03);
      d.scale.setScalar(0.012 + Math.pow(hash1(i * 3 + 3), 3) * 0.035);
      d.rotation.set(hash1(i) * 6, hash1(i + 1) * 6, hash1(i + 2) * 6);
      d.updateMatrix();
      grains.setMatrixAt(i, d.matrix);
    }
  }
  scene.add(grains);

  const glow = new THREE.PointLight(0xffa850, 0, 12, 1.5);
  glow.position.copy(nuggetPos).add(new THREE.Vector3(0, 0.3, 1.2));
  scene.add(glow);
  const key = new THREE.DirectionalLight(0xffe0b0, 1.6);
  key.position.set(-3, 6, 5);
  scene.add(key);

  const dust = new Dust({ count: 700, size: 0.018, box: [8, 6, 5], color: [1, 0.8, 0.55], gain: 0.9, seed: 5 });
  scene.add(dust);

  const S = {
    scene, wall, nugget, grains, grainMat, glow, key, dust, U, nuggetPos, veinY,
    fx: { bloom: 0.55, threshold: 0.9, bloomRadius: 0.5, grain: 0.055, vignette: 0.55, tint: [1.02, 0.99, 0.94] },
    update(ctx) {
      U.uTime.value = ctx.t;
      U.uGlow.value = 1; U.uFlare.value = 0; U.uLamp.value = 1.3;
      goldMat.emissiveIntensity = 0.03;
      glow.intensity = 0;
      dust.visible = true;
      dust.setTime(ctx.t, [0.02, -0.12, 0]);
      dust.position.set(nuggetPos.x, nuggetPos.y + 1, 2.5);
    },
  };
  return S;
}
