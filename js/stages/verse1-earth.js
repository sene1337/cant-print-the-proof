// VERSE 1 earth stage: a cut through the island's ground, strata going down into the dark,
// and a quartz vein with gold in it. Moonlight at the top; the gold's own glow at the bottom.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Dust } from '../props/dust.js';
import { clamp, hash1 } from '../util.js';

const WALL = /* glsl */ `
  uniform float uTime, uGlow, uFlare, uLamp;
  uniform vec3 uNugget, uMoonDir;
  varying vec3 vW;
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  // Pebbles: distance to the nearest jittered cell centre.
  vec2 cells(vec2 p) {
    vec2 i = floor(p), f = fract(p); float d = 9.0, id = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y)); vec2 o = hash22(i + g);
      float dd = length(g + o - f); if (dd < d) { d = dd; id = hash12(i + g + 3.1); }
    }
    return vec2(d, id);
  }
  float surfY(float x) { return 0.18 * sin(x * 0.7 + 1.0) + 0.1 * sin(x * 2.3) + 0.05 * sin(x * 5.1); }
  float veinY(float x) { return -8.2 + 0.32 * x + 0.35 * sin(x * 0.9 + 0.4) + 0.12 * sin(x * 3.1); }

  // Height field and albedo of the rock face at p. Domain-warped noise keeps it from looking drawn.
  void rock(vec2 p, out float h, out vec3 alb, out float gold, out float wet) {
    float d = surfY(p.x) - p.y; // depth below ground
    vec2 w = p + vec2(fbm(p * 0.7 + 1.3), fbm(p * 0.7 + 7.1)) * 0.7;
    float n = fbm(w * 1.8);
    float wob = (fbm(vec2(p.x * 0.3, 3.0)) - 0.5) * 1.0;
    float dd = d + wob * 0.5;
    gold = 0.0; wet = 0.0;
    if (dd < 0.5) { // topsoil with roots
      alb = vec3(0.06, 0.045, 0.032) * (0.6 + 0.8 * n);
      float root = smoothstep(0.025, 0.0, abs(sin(p.x * 2.6 + fbm(p * 2.5) * 5.0) * 0.3 + (d - 0.3) * 0.8));
      alb = mix(alb, vec3(0.15, 0.11, 0.075), root * 0.7);
      h = n * 0.3 + root * 0.2;
    } else if (dd < 1.8) { // clay with thin laminations
      float lam = fbm(vec2(w.x * 0.4, w.y * 7.0));
      alb = mix(vec3(0.17, 0.085, 0.05), vec3(0.3, 0.16, 0.09), lam) * (0.75 + 0.5 * n);
      h = n * 0.3 + lam * 0.15;
    } else if (dd < 3.1) { // sand full of small stones
      vec2 c = cells(w * 7.0 + 3.0);
      float cd = c.x + (vnoise(p * 23.0) - 0.5) * 0.18;
      float peb = smoothstep(0.36, 0.2, cd);
      alb = vec3(0.36, 0.26, 0.14) * (0.7 + 0.6 * n);
      vec3 pc = mix(vec3(0.22, 0.21, 0.2), mix(vec3(0.35, 0.2, 0.12), vec3(0.42, 0.4, 0.36), step(0.5, c.y)), step(0.3, c.y));
      alb = mix(alb, pc * (0.7 + 0.5 * vnoise(p * 40.0)), peb);
      h = n * 0.25 + peb * (0.4 + 0.2 * c.y);
    } else if (dd < 4.9) { // cobbles packed in dark grit
      vec2 c2 = cells(w * 2.3 + 11.0);
      float cd = c2.x + (fbm(p * 6.0) - 0.5) * 0.25;
      float cob = smoothstep(0.52, 0.3, cd);
      vec3 cc = mix(vec3(0.16, 0.15, 0.14), vec3(0.28, 0.22, 0.17), c2.y) * (0.6 + 0.7 * fbm(p * 9.0 + c2.y * 10.0));
      alb = mix(vec3(0.05, 0.042, 0.035) * (0.7 + 0.6 * n), cc, cob);
      h = cob * (0.7 + 0.4 * (1.0 - cd)) + n * 0.2;
    } else { // bedrock: dark slate with a grain and cracks
      float gr = fbm(vec2(w.x * 0.5, w.y * 3.2));
      alb = mix(vec3(0.045, 0.048, 0.055), vec3(0.11, 0.105, 0.105), gr) * (0.7 + 0.6 * n);
      float crack = smoothstep(0.025, 0.0, abs(fbm(w * 0.8 + 5.0) - 0.5)) * 0.8;
      alb *= 1.0 - crack * 0.7;
      h = n * 0.35 + gr * 0.1 - crack * 0.3;
      wet = 0.3 + crack;
    }
    // The vein: a seam of quartz carrying gold.
    float vy = veinY(p.x);
    float vw = 0.09 + 0.05 * sin(p.x * 1.7) + 0.05 * fbm(p * 3.0);
    float vd = abs(p.y - vy + (fbm(p * 2.0) - 0.5) * 0.2);
    float inV = smoothstep(vw, vw - 0.03, vd);
    if (inV > 0.0) {
      vec3 q = vec3(0.4, 0.38, 0.35) * (0.6 + 0.6 * fbm(p * 7.0));
      alb = mix(alb, q, inV);
      h = mix(h, 0.5 + fbm(p * 6.0) * 0.35, inV);
      float fl = smoothstep(0.64, 0.82, fbm(p * 10.0 + 3.3)) * inV;
      gold = max(gold, fl);
      wet = mix(wet, 0.9, inV);
    }
  }
`;

function wallMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${WALL}
      void main() {
        vec2 p = vW.xy;
        float sy = surfY(p.x);
        if (p.y > sy + 0.02) {
          // the night above the ground line, with the island's low growth in silhouette
          float bush = max(0.0, fbm(vec2(p.x * 0.6, 7.0)) - 0.45) * 1.1 + max(0.0, fbm(vec2(p.x * 2.4, 2.0)) - 0.5) * 0.35;
          vec3 sky = mix(vec3(0.02, 0.055, 0.065), vec3(0.002, 0.006, 0.01), clamp((p.y - sy) / 3.0, 0.0, 1.0));
          float sil = step(p.y - sy, bush);
          gl_FragColor = vec4(mix(sky, vec3(0.004, 0.006, 0.005), sil), 1.0);
          return;
        }
        float h, gold, wet; vec3 alb;
        rock(p, h, alb, gold, wet);
        // Normal from screen-space derivatives: one evaluation of the rock per pixel keeps it cheap.
        vec2 dpx = dFdx(p), dpy = dFdy(p);
        float hx = dFdx(h), hy = dFdy(h);
        float det = dpx.x * dpy.y - dpx.y * dpy.x;
        vec2 grad = abs(det) > 1e-12 ? vec2(hx * dpy.y - hy * dpx.y, hy * dpx.x - hx * dpy.x) / det : vec2(0.0);
        grad = clamp(grad, -12.0, 12.0);
        vec3 N = normalize(vec3(-grad.x * 0.06, -grad.y * 0.06, 1.0));
        vec3 V = normalize(cameraPosition - vW);
        // Moonlight spills in at the top and fades with depth; a soft lamp travels with us down the cut.
        float depth = sy - p.y;
        float moonAmt = exp(-depth * 0.3);
        vec3 L1 = normalize(vec3(-0.45, 0.8, 0.45));
        vec3 col = alb * vec3(0.5, 0.68, 0.72) * (max(dot(N, L1), 0.0) * 1.5 + 0.2) * moonAmt;
        vec3 lampP = cameraPosition + vec3(-1.6, 1.8, -0.8);
        vec3 Ll = lampP - vW; float dl = length(Ll); Ll /= dl;
        col += alb * vec3(1.0, 0.86, 0.68) * max(dot(N, Ll), 0.0) * uLamp / (1.0 + dl * dl * 0.06);
        col += alb * vec3(0.04, 0.05, 0.06);
        // The gold's glow lights the rock around the vein.
        vec3 toN = uNugget - vW;
        float dn = length(toN);
        vec3 Ln = toN / dn;
        float fall = uGlow / (1.0 + dn * dn * 0.9);
        col += alb * vec3(1.0, 0.62, 0.25) * max(dot(N, Ln), 0.0) * fall * 2.2;
        vec3 Hh = normalize(Ln + V);
        col += vec3(1.0, 0.7, 0.35) * pow(max(dot(N, Hh), 0.0), 40.0) * fall * wet * 0.8;
        // Gold flecks shine on their own.
        float tw = 0.75 + 0.25 * sin(uTime * 3.0 + p.x * 40.0 + p.y * 23.0);
        col += vec3(1.0, 0.68, 0.22) * gold * (0.35 + uGlow * 0.5 + uFlare * 2.0 * exp(-dn * 0.7)) * tw;
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

  const U = {
    uTime: { value: 0 }, uGlow: { value: 1 }, uFlare: { value: 0 }, uLamp: { value: 1.3 },
    uNugget: { value: new THREE.Vector3(0.7, -8, 0.15) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
  };
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 60), wallMaterial(U));
  wall.position.set(0, -22, 0);
  scene.add(wall);

  const veinY = (x) => -8.2 + 0.32 * x + 0.35 * Math.sin(x * 0.9 + 0.4) + 0.12 * Math.sin(x * 3.1);
  const nx = 0.7;
  const nuggetPos = new THREE.Vector3(nx, veinY(nx) + 0.02, 0.12);
  U.uNugget.value.copy(nuggetPos);

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.76, 0.33), metalness: 1, roughness: 0.32, envMapIntensity: 1.4,
    emissive: new THREE.Color(1.0, 0.55, 0.15), emissiveIntensity: 0.05,
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
      goldMat.emissiveIntensity = 0.05;
      glow.intensity = 0;
      dust.visible = true;
      dust.setTime(ctx.t, [0.02, -0.12, 0]);
      dust.position.set(nuggetPos.x, nuggetPos.y + 1, 2.5);
    },
  };
  return S;
}
