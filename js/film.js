// The film engine: one renderer, one camera, many stages, and a shot list.
// render(t) draws the frame for song time t. Nothing depends on wall-clock time,
// so the browser can play it live and the render script can draw any frame in any order.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { clamp, lerp, noise1 } from './util.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFrame: { value: 0 },
    uGrain: { value: 0.05 },
    uVignette: { value: 0.35 },
    uCA: { value: 0.0015 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.85, 0.6) },
    uFade: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uLift: { value: new THREE.Color(0, 0, 0) },
    uSat: { value: 1 },
    uContrast: { value: 1.05 },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uFrame, uGrain, uVignette, uCA, uFlash, uFade, uSat, uContrast, uAspect;
    uniform vec3 uFlashColor, uTint, uLift;
    varying vec2 vUv;
    // Integer hash per pixel and frame: no streaks or banding in the grain.
    float grainHash(vec2 fc, float frame) {
      uint f = uint(frame);
      uvec2 p = uvec2(fc) + uvec2(f * 1973u, f * 9277u);
      p = p * uvec2(1597334673u, 3812015801u);
      uint n = (p.x ^ p.y) * 1597334673u;
      n ^= n >> 16;
      return float(n) / 4294967295.0;
    }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
      vec2 off = c * uCA * (0.5 + r2 * 2.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      col = col * uTint + uLift * (1.0 - col);
      float v = smoothstep(1.25, 0.2, sqrt(r2) * 1.1);
      col *= mix(1.0, v, uVignette);
      col += uFlashColor * uFlash;
      float g = grainHash(gl_FragCoord.xy, uFrame) - 0.5;
      col += g * uGrain * (0.6 + 0.4 * (1.0 - l));
      col *= 1.0 - uFade;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export class Film {
  constructor({ canvas, timing, chain, width, height, quality = 'high', pixelRatio = 1 }) {
    this.T = timing;
    this.chain = chain;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: quality === 'offline',
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.05, 5000);
    this.stages = new Map();
    this.shots = [];
    this.current = null;

    const rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: quality === 'low' ? 0 : 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    this.composer.addPass(this.renderPass);
    this.bokeh = new BokehPass(new THREE.Scene(), this.camera, { focus: 5, aperture: 0.0002, maxblur: 0.008 });
    this.bokeh.enabled = false;
    this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.8, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.setSize(width, height, pixelRatio);
  }

  setSize(w, h, pr = this.renderer.getPixelRatio()) {
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.final.uniforms.uAspect.value = w / h;
  }

  addStage(id, stage) {
    this.stages.set(id, stage);
  }

  setShots(shots) {
    this.shots = shots.slice().sort((a, b) => a.t - b.t);
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      s.end = i + 1 < this.shots.length ? this.shots[i + 1].t : this.T.duration + 1;
      s.index = i;
    }
  }

  shotAt(t) {
    const S = this.shots;
    let lo = 0, hi = S.length - 1, ans = 0;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (S[m].t <= t) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return S[ans];
  }

  // Draw song time t. frame is only used to seed film grain.
  render(t, frame = Math.round(t * 30)) {
    const shot = this.shotAt(t);
    const stage = this.stages.get(shot.stage);
    if (!stage) throw new Error(`missing stage ${shot.stage}`);
    const lt = t - shot.t;
    const dur = shot.end - shot.t;
    const ctx = {
      t, lt, dur, u: clamp(lt / dur), shot, T: this.T, film: this,
      kick: this.T.kick(t, 7), aspect: this.width / this.height,
    };
    const cam = this.camera;
    cam.fov = 35; cam.near = 0.05; cam.far = 5000; cam.up.set(0, 1, 0);
    if (shot !== this.current) {
      if (this.current && this.current.stage !== shot.stage) {
        const prev = this.stages.get(this.current.stage);
        prev.exit && prev.exit();
      }
      stage.enter && stage.enter(shot);
      this.current = shot;
    }
    const fx = Object.assign({}, stage.fx || {}, shot.fx || {});
    stage.update(ctx, cam);
    shot.set && shot.set(stage, ctx, cam);
    if (shot.cam) shot.cam(ctx, cam, stage);
    // Handheld drift and beat punch, both deterministic.
    const shake = fx.shake ?? 0.004;
    if (shake > 0) {
      const k = ctx.kick * (fx.punch ?? 1);
      const dx = (noise1(t * 1.3, 11) - 0.5) * shake + (noise1(t * 23, 3) - 0.5) * shake * 0.6 * k;
      const dy = (noise1(t * 1.1, 17) - 0.5) * shake + (noise1(t * 21, 5) - 0.5) * shake * 0.6 * k;
      cam.rotateX(dy);
      cam.rotateY(dx);
    }
    cam.updateProjectionMatrix();

    const scene = stage.scene;
    this.renderPass.scene = scene;
    this.renderPass.camera = cam;
    const ap = fx.aperture ?? 0;
    this.bokeh.enabled = ap > 0 && this.quality !== 'low';
    if (this.bokeh.enabled) {
      this.bokeh.scene = scene;
      this.bokeh.camera = cam;
      this.bokeh.uniforms.focus.value = fx.focus ?? 5;
      this.bokeh.uniforms.aperture.value = ap;
      this.bokeh.uniforms.maxblur.value = fx.maxblur ?? 0.01;
      this.bokeh.uniforms.aspect.value = cam.aspect;
    }
    this.bloom.strength = fx.bloom ?? 0.8;
    this.bloom.radius = fx.bloomRadius ?? 0.55;
    this.bloom.threshold = fx.threshold ?? 0.8;
    this.renderer.toneMappingExposure = fx.exposure ?? 1.0;

    const U = this.final.uniforms;
    U.uTime.value = t;
    U.uFrame.value = frame;
    U.uGrain.value = fx.grain ?? 0.045;
    U.uVignette.value = fx.vignette ?? 0.45;
    U.uCA.value = (fx.ca ?? 0.0012) * (1 + ctx.kick * (fx.caKick ?? 1.5));
    U.uSat.value = fx.sat ?? 1;
    U.uContrast.value = fx.contrast ?? 1.05;
    U.uTint.value.set(...(fx.tint || [1, 1, 1]));
    U.uLift.value.set(...(fx.lift || [0, 0, 0]));
    let flash = 0;
    if (fx.flashOnCut !== false) flash += Math.max(0, 1 - lt / 0.12) * (fx.cutFlash ?? 0);
    if (shot.flash) flash += shot.flash(ctx) || 0;
    U.uFlash.value = flash;
    if (fx.flashColor) U.uFlashColor.value.set(...fx.flashColor);
    else U.uFlashColor.value.set(1, 0.85, 0.6);
    let fade = 0;
    if (fx.fadeIn) fade = Math.max(fade, 1 - clamp(lt / fx.fadeIn));
    if (fx.fadeOut) fade = Math.max(fade, 1 - clamp((shot.end - t) / fx.fadeOut));
    U.uFade.value = fade;

    this.composer.render();
    return ctx;
  }
}

// A studio baked into an environment map: a soft gradient dome (so metal always has something to reflect)
// plus bright soft boxes for crisp highlights.
export function studioEnv(renderer, boxes, { top = [0, 0, 0], horizon = [0, 0, 0], bottom = [0, 0, 0] } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const dome = new THREE.SphereGeometry(50, 64, 32);
  const col = [];
  const p = dome.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    const c = y >= 0
      ? [0, 1, 2].map((k) => horizon[k] + (top[k] - horizon[k]) * Math.pow(y, 0.7))
      : [0, 1, 2].map((k) => horizon[k] + (bottom[k] - horizon[k]) * Math.pow(-y, 0.5));
    col.push(...c);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const geo = new THREE.PlaneGeometry(1, 1);
  for (const b of boxes) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...b.color).multiplyScalar(b.intensity ?? 4), side: THREE.DoubleSide });
    const q = new THREE.Mesh(geo, m);
    q.position.set(...b.pos);
    q.scale.set(b.size[0], b.size[1], 1);
    q.lookAt(0, 0, 0);
    scene.add(q);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  return tex;
}

export function orbitCam(o) {
  // o: target [x,y,z] or fn, dist [a,b], az [a,b] degrees, el [a,b] degrees, fov, roll, ease
  return (ctx, cam) => {
    const e = o.ease || ((x) => x);
    const u = e(ctx.u);
    const tg = typeof o.target === 'function' ? o.target(ctx) : (o.target || [0, 0, 0]);
    const lerpv = (v) => (Array.isArray(v) ? lerp(v[0], v[1], u) : v);
    const aspectZoom = Math.pow(Math.max(1, (16 / 9) / ctx.aspect), 0.8);
    const d = lerpv(o.dist) * aspectZoom;
    const az = (lerpv(o.az ?? 0) * Math.PI) / 180;
    const el = (lerpv(o.el ?? 0) * Math.PI) / 180;
    cam.position.set(tg[0] + d * Math.sin(az) * Math.cos(el), tg[1] + d * Math.sin(el), tg[2] + d * Math.cos(az) * Math.cos(el));
    const look = o.look ? (typeof o.look === 'function' ? o.look(ctx) : o.look) : tg;
    cam.lookAt(look[0], look[1], look[2]);
    if (o.roll) cam.rotateZ((lerpv(o.roll) * Math.PI) / 180);
    cam.fov = lerpv(o.fov ?? 35);
    if (o.near) cam.near = o.near;
    if (o.far) cam.far = o.far;
  };
}

// Straight camera move from p0 to p1 looking at l0 -> l1.
export function moveCam(o) {
  return (ctx, cam) => {
    const e = o.ease || ((x) => x);
    const u = e(ctx.u);
    const L = (a, b) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
    const aspectZoom = Math.pow(Math.max(1, (16 / 9) / ctx.aspect), 0.8);
    const p = L(o.from, o.to || o.from);
    const l = L(o.look, o.look2 || o.look);
    cam.position.set(l[0] + (p[0] - l[0]) * aspectZoom, l[1] + (p[1] - l[1]) * aspectZoom, l[2] + (p[2] - l[2]) * aspectZoom);
    cam.lookAt(l[0], l[1], l[2]);
    if (o.roll) cam.rotateZ((lerp(o.roll[0], o.roll[1] ?? o.roll[0], u) * Math.PI) / 180);
    cam.fov = Array.isArray(o.fov) ? lerp(o.fov[0], o.fov[1], u) : o.fov ?? 35;
    if (o.near) cam.near = o.near;
    if (o.far) cam.far = o.far;
  };
}
