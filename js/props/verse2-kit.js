// Helpers shared by the verse 2 stages: a noise field (same values on CPU and GPU), the tin creep,
// the burn / erode dissolve, and time-pure particle meshes. Everything is a pure function of song time.
import * as THREE from 'three';
import { hash1, clamp, lerp } from '../util.js';

// ---------------------------------------------------------------- noise field
// Tileable value-noise fbm, quantised to bytes so the shader and the JS sampler see identical values.
export function noiseField(size = 256, seed = 1, octaves = 5) {
  const acc = new Float32Array(size * size);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o;
    const val = (i, j) => hash1(((j % cells) * cells + (i % cells)) * 13 + o * 7919 + seed * 104729);
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cells, j = Math.floor(fy), ty = fy - j, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells, i = Math.floor(fx), tx = fx - i, sx = tx * tx * (3 - 2 * tx);
        const a = val(i, j), b = val(i + 1, j), c = val(i, j + 1), d = val(i + 1, j + 1);
        acc[y * size + x] += amp * lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
      }
    }
    amp *= 0.5;
  }
  let mn = Infinity, mx = -Infinity;
  for (const v of acc) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const u8 = new Uint8Array(size * size);
  const data = new Float32Array(size * size);
  for (let k = 0; k < acc.length; k++) {
    u8[k] = Math.round(((acc[k] - mn) / (mx - mn)) * 255);
    data[k] = u8[k] / 255;
  }
  const tex = new THREE.DataTexture(u8, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { size, data, tex };
}

// Bilinear sample with wrap, matching GPU linear filtering.
export function sampleField(F, u, v) {
  const n = F.size;
  const x = u * n - 0.5, y = v * n - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const g = (i, j) => F.data[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
  return lerp(lerp(g(x0, y0), g(x0 + 1, y0), fx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), fx), fy);
}

// ---------------------------------------------------------------- composable shader patches
// patch(mat, key, fn): fn(shader) edits the compiled shader; several patches can stack on one material.
export function patch(mat, key, fn) {
  const list = mat.userData.v2patches || (mat.userData.v2patches = []);
  if (list.some((p) => p.key === key)) return mat;
  list.push({ key, fn });
  mat.onBeforeCompile = (sh) => { for (const p of list) p.fn(sh); };
  mat.customProgramCacheKey = () => 'v2:' + list.map((p) => p.key).join('+');
  mat.needsUpdate = true;
  return mat;
}

// Clamp a material's HDR output so tiny mirror highlights bloom as a glint, not a white-out.
export function clampHot(mat, max = 6) {
  return patch(mat, 'clamp' + max, (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
      `#include <opaque_fragment>\ngl_FragColor.rgb = min(gl_FragColor.rgb, vec3(${max.toFixed(2)}));`);
  });
}

// ---------------------------------------------------------------- tin creep
// Grey base metal spreads out of the wounds (object-space xy points) across a coin's face and edge.
// U.uTin: front radius (below 0 = none, ~2.6 = whole coin).
export function tinUniforms(field) {
  return {
    uTin: { value: -1 },
    uWounds: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uTinCol: { value: new THREE.Color(0.3, 0.315, 0.33) },
    uTinRough: { value: 0.6 },
    uField: { value: field.tex },
  };
}

export function patchTin(mat, U) {
  return patch(mat, 'tin', (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObjP;
        uniform float uTin; uniform vec4 uWounds[6]; uniform vec3 uTinCol; uniform float uTinRough; uniform sampler2D uField;
        float tinX() {
          float d = 9.0;
          for (int i = 0; i < 6; i++) { if (uWounds[i].w > 0.5) d = min(d, length(vObjP.xy - uWounds[i].xy)); }
          float n = texture2D(uField, vObjP.xy * 0.31 + 0.5).r;
          return d + (n - 0.5) * 0.9;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float tinXv = tinX();
        float tinM = 1.0 - smoothstep(uTin - 0.05, uTin + 0.05, tinXv);
        float tinBand = smoothstep(uTin - 0.2, uTin - 0.05, tinXv) * (1.0 - smoothstep(uTin - 0.02, uTin + 0.1, tinXv));
        vec3 tinTex = diffuseColor.rgb / max(diffuse, vec3(0.001));
        diffuseColor.rgb = mix(diffuseColor.rgb, uTinCol * tinTex, tinM);
        diffuseColor.rgb *= 1.0 - tinBand * 0.7;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uTinRough, tinM);`);
  });
}

// ---------------------------------------------------------------- burn / erode
// A paper sheet that disappears where field(uv) < uBurn. mode 0: from all edges inward; mode 1: sweep from uv.x = 0.
export function burnUniforms(field, o = {}) {
  return {
    uBurn: { value: -1 },
    uField: { value: field.tex },
    uMode: { value: o.mode ?? 0 },
    uAspect: { value: o.aspect ?? 1 },
    uNoiseAmp: { value: o.noiseAmp ?? 0.35 },
    uNoiseScale: { value: o.noiseScale ?? 1.3 },
    uCharW: { value: o.charW ?? 0.09 },
    uCharCol: { value: new THREE.Color(...(o.charCol || [0.05, 0.035, 0.025])) },
    uEmberW: { value: o.emberW ?? 0.022 },
    uEmberCol: { value: new THREE.Color(...(o.emberCol || [1.0, 0.42, 0.08])) },
    uEmberGain: { value: o.emberGain ?? 6 },
    uTime: { value: 0 },
  };
}

export const BURN_FIELD_GLSL = `
  float burnField(vec2 uv) {
    float base;
    if (uMode < 0.5) {
      float bx = min(uv.x, 1.0 - uv.x) * uAspect;
      float by = min(uv.y, 1.0 - uv.y);
      base = min(bx, by) / (0.5 * min(uAspect, 1.0));
    } else {
      base = uv.x;
    }
    return base + (texture2D(uField, uv * uNoiseScale).r - 0.5) * uNoiseAmp;
  }`;

// JS twin of burnField (for spawning particles exactly on the front).
export function burnFieldJS(F, U, u, v) {
  let base;
  if (U.uMode.value < 0.5) {
    const a = U.uAspect.value;
    base = Math.min(Math.min(u, 1 - u) * a, Math.min(v, 1 - v)) / (0.5 * Math.min(a, 1));
  } else base = u;
  const s = U.uNoiseScale.value;
  return base + (sampleField(F, u * s, v * s) - 0.5) * U.uNoiseAmp.value;
}

export function patchBurn(mat, U) {
  return patch(mat, 'burn', (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBurnUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBurnUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vBurnUv;
        uniform float uBurn, uMode, uAspect, uNoiseAmp, uNoiseScale, uCharW, uEmberW, uEmberGain, uTime;
        uniform vec3 uCharCol, uEmberCol; uniform sampler2D uField;
        ${BURN_FIELD_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float bE = burnField(vBurnUv) - uBurn;
        if (bE < 0.0) discard;
        float bChar = 1.0 - smoothstep(0.0, uCharW, bE);
        diffuseColor.rgb = mix(diffuseColor.rgb, uCharCol, bChar * bChar);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float bEk = 1.0 - smoothstep(0.0, uEmberW, bE);
        float bFl = 0.55 + 0.9 * texture2D(uField, vBurnUv * 4.0 + vec2(uTime * 0.11, -uTime * 0.19)).r;
        totalEmissiveRadiance += uEmberCol * bEk * bEk * uEmberGain * bFl;`);
  });
}

// ---------------------------------------------------------------- particles
const _d = new THREE.Object3D();

// Lit instanced pieces (shavings, flakes, chips). place(i, dummy) returns false to hide.
export class Pieces extends THREE.InstancedMesh {
  constructor(geo, mat, count) {
    super(geo, mat, count);
    this.capacity = count;
    this.frustumCulled = false;
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  layout(n, place) {
    let k = 0;
    for (let i = 0; i < n && k < this.capacity; i++) {
      _d.position.set(0, 0, 0); _d.rotation.set(0, 0, 0); _d.scale.set(1, 1, 1);
      if (place(i, _d) === false) continue;
      _d.updateMatrix();
      this.setMatrixAt(k++, _d.matrix);
    }
    this.count = k;
    this.instanceMatrix.needsUpdate = true;
    return k;
  }
}

// Flakes that carry a piece of a texture each (per-instance uv rectangle) and can glow.
export function flakeMaterial(map, { rough = 0.9, emberCol = [1, 0.4, 0.08], side = THREE.DoubleSide } = {}) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0, side });
  mat.userData.emberCol = { value: new THREE.Color(...emberCol) };
  return patch(mat, 'flake', (sh) => {
    sh.uniforms.uEmberCol = mat.userData.emberCol;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRect; attribute vec2 aGlow; varying vec2 vGlow;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aRect.xy + vMapUv * aRect.zw;\n#endif\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGlow; uniform vec3 uEmberCol;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= 1.0 - vGlow.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uEmberCol * vGlow.x;');
  });
}

export class Flakes extends Pieces {
  constructor(geo, mat, count) {
    super(geo, mat, count);
    this.rect = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.glow = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    this.rect.setUsage(THREE.DynamicDrawUsage);
    this.glow.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aRect', this.rect);
    geo.setAttribute('aGlow', this.glow);
  }
  // place(i, dummy, rect[4], glow[2]) returns false to hide.
  layoutFlakes(n, place) {
    const r = [0, 0, 1, 1], g = [0, 0];
    let k = 0;
    for (let i = 0; i < n && k < this.capacity; i++) {
      _d.position.set(0, 0, 0); _d.rotation.set(0, 0, 0); _d.scale.set(1, 1, 1);
      r[0] = 0; r[1] = 0; r[2] = 1; r[3] = 1; g[0] = 0; g[1] = 0;
      if (place(i, _d, r, g) === false) continue;
      _d.updateMatrix();
      this.setMatrixAt(k, _d.matrix);
      this.rect.setXYZW(k, r[0], r[1], r[2], r[3]);
      this.glow.setXY(k, g[0], g[1]);
      k++;
    }
    this.count = k;
    this.instanceMatrix.needsUpdate = true;
    this.rect.needsUpdate = true;
    this.glow.needsUpdate = true;
    return k;
  }
}

// Soft round points with per-point size (world units) and alpha. For dust puffs and smoke.
function softSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let SOFT = null;

export class SoftPoints extends THREE.Points {
  constructor(count, { color = [1, 1, 1], additive = false, opacity = 1 } = {}) {
    SOFT = SOFT || softSprite();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: SOFT }, uColor: { value: new THREE.Color(...color) }, uScale: { value: 540 }, uOpacity: { value: opacity } },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.001, -mv.z);
          vA = aAlpha;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a * vA * uOpacity;
          if (a < 0.003) discard;
          gl_FragColor = vec4(uColor, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    super(geo, mat);
    this.capacity = count;
    this.frustumCulled = false;
  }
  // place(i, out{x,y,z,size,alpha}) returns false to hide. scale: pixels per world unit at distance 1.
  layout(n, place, pxScale) {
    const P = this.geometry.attributes.position, S = this.geometry.attributes.aSize, A = this.geometry.attributes.aAlpha;
    const o = { x: 0, y: 0, z: 0, size: 0.1, alpha: 1 };
    let k = 0;
    for (let i = 0; i < n && k < this.capacity; i++) {
      o.size = 0.1; o.alpha = 1;
      if (place(i, o) === false) continue;
      P.setXYZ(k, o.x, o.y, o.z); S.setX(k, o.size); A.setX(k, o.alpha);
      k++;
    }
    this.geometry.setDrawRange(0, k);
    P.needsUpdate = S.needsUpdate = A.needsUpdate = true;
    if (pxScale) this.material.uniforms.uScale.value = pxScale;
    return k;
  }
}

// Pixels per world unit at distance 1 for the current camera and canvas (for SoftPoints).
export function pointScale(film, cam) {
  const h = film.renderer.domElement.height;
  return h / (2 * Math.tan((cam.fov * Math.PI) / 360));
}

// ---------------------------------------------------------------- canvas helpers
export function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function canvasTex(c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// Deterministic impact shake: a decaying wobble that starts at t0.
export function impactShake(t, t0, amp = 0.02, decay = 9, freq = 31) {
  const dt = t - t0;
  if (dt < 0) return [0, 0];
  const e = amp * Math.exp(-decay * dt);
  return [Math.sin(dt * freq) * e, Math.sin(dt * freq * 1.37 + 1.1) * e * 0.8];
}

export { clamp };
