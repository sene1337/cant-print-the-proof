// "Your sunrise": the simulator's answer as a scene. Your freedom year stands in cast metal on wet ground that
// mirrors it; the sooner you are free, the higher the sun. Never free: night, and NOT YET.
// The sky is drawn per pixel with a continuous time of day, and mirrored below the horizon for the wet ground.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Solid text from glyph outlines (data/sim-glyphs.json). An inward bevel spikes across the face at the sharp corners
// of Playfair's lining 2 and its N, so here the bevel grows outward from the true outline, and the face keeps the
// font's exact shape.
function glyphGeometry(g, scale, depth, bevel) {
  const path = new THREE.ShapePath(), s = scale / 1000;
  for (const c of g.cmds) {
    if (c[0] === 'M') path.moveTo(c[1] * s, c[2] * s);
    else if (c[0] === 'L') path.lineTo(c[1] * s, c[2] * s);
    else if (c[0] === 'Q') path.quadraticCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s);
    else if (c[0] === 'C') path.bezierCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s, c[5] * s, c[6] * s);
  }
  const geo = new THREE.ExtrudeGeometry(path.toShapes(false), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: 0, bevelSegments: 4, curveSegments: 12 });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}
function buildText(glyphs, text, { scale = 2.2, depth = 0.45, bevel = 0.06, material }) {
  const group = new THREE.Group(), parts = [];
  let x = 0;
  for (const ch of text) {
    const g = glyphs.glyphs[ch];
    const holder = new THREE.Group();
    if (g.cmds.length) holder.add(new THREE.Mesh(glyphGeometry(g, scale, depth, bevel), material));
    holder.position.x = x;
    group.add(holder);
    parts.push(holder);
    x += (g.advance * scale) / 1000;
  }
  for (const p of parts) p.position.x -= x / 2;
  group.userData.width = x;
  return { group, parts };
}

const NIGHT = { Z: [0.001, 0.002, 0.008], M: [0.006, 0.01, 0.03], Hs: [0.06, 0.08, 0.14], Ha: [0.02, 0.025, 0.05], sun: [0.7, 0.78, 1.0] };
const DAWN = { Z: [0.004, 0.009, 0.035], M: [0.09, 0.05, 0.11], Hs: [0.75, 0.27, 0.07], Ha: [0.12, 0.06, 0.08], sun: [1.0, 0.62, 0.3] };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const back = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export async function createSunrise(canvas) {
  const glyphs = await (await fetch('./data/sim-glyphs.json')).json();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 3000);

  // Sky: per pixel, mirrored below the horizon for the wet ground.
  const v3 = (a) => ({ value: new THREE.Vector3(...a) });
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uSun: v3([0.16, 0.02, -1]), uGlow: { value: 1 }, uStars: { value: 0 }, uZ: v3(DAWN.Z), uM: v3(DAWN.M), uHs: v3(DAWN.Hs), uHa: v3(DAWN.Ha), uSunCol: v3(DAWN.sun) },
    vertexShader: `varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uSun, uZ, uM, uHs, uHa, uSunCol; uniform float uGlow, uStars; varying vec3 vDir;
      float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir);
        float below = step(d.y, 0.0);
        d.y = abs(d.y);
        vec2 dxz = d.xz / max(1e-4, length(d.xz));
        float facing = max(0.0, dot(normalize(uSun.xz), dxz));
        vec3 H = mix(uHa, uHs, pow(facing, 4.0));
        vec3 c = mix(uZ, uM, smoothstep(0.0, 1.0, pow(1.0 - d.y, 4.0)));
        c = mix(c, H, smoothstep(0.35, 1.0, pow(1.0 - d.y, 9.0)));
        float s = max(0.0, dot(d, normalize(vec3(uSun.x, abs(uSun.y), uSun.z))));
        float up = step(0.0, uSun.y);
        c += uSunCol * (pow(s, 5000.0) * 3.2 * up + pow(s, 400.0) * 0.3 * up + pow(s, 24.0) * 0.07) * uGlow;
        float st = step(0.9982, hash3(floor(d * 900.0))) * smoothstep(0.06, 0.3, d.y) * uStars;
        c += vec3(0.75, 0.82, 1.0) * st * 0.8;
        c *= mix(1.0, 0.5, below);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), skyMat));
  const setSky = (k) => {
    const U = skyMat.uniforms, m = smooth(0.12, 0.9, k);
    for (const [key, name] of [['uZ', 'Z'], ['uM', 'M'], ['uHs', 'Hs'], ['uHa', 'Ha'], ['uSunCol', 'sun']]) {
      U[key].value.set(...NIGHT[name].map((v, i) => v + (DAWN[name][i] - v) * m));
    }
    U.uSun.value.set(0.16, -0.13 + 0.2 * k, -1).normalize();
    U.uGlow.value = 0.35 + 1.0 * smooth(0.2, 1, k);
    U.uStars.value = 1 - smooth(0.1, 0.55, k);
  };

  // What the metal reflects: the sky plus a soft panel behind the camera, at five times of day.
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), skyMat));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(70, 16), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
  fill.position.set(0, 7, 30); fill.lookAt(0, 2, 0);
  envScene.add(fill);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envs = [0, 0.25, 0.5, 0.75, 1].map((k) => {
    setSky(k);
    fill.material.color.setRGB(0.34 - 0.14 * k, 0.4 - 0.26 * k, 0.55 - 0.45 * k);
    return pmrem.fromScene(envScene, 0.02, 0.1, 200).texture;
  });
  pmrem.dispose();

  // Wet ground: dark near the camera, a mirror toward the horizon.
  const wetMat = new THREE.MeshPhysicalMaterial({ color: 0x080605, roughness: 0.6, metalness: 0, specularIntensity: 0.06, transparent: true, envMapIntensity: 0 });
  wetMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 3.0);
      diffuseColor.a = mix(0.93, 0.42, fres);
      #include <opaque_fragment>`);
  };
  wetMat.customProgramCacheKey = () => 'sim-wet-ground';
  const wet = new THREE.Mesh(new THREE.CircleGeometry(400, 96), wetMat);
  wet.rotation.x = -Math.PI / 2;
  wet.renderOrder = 2;
  scene.add(wet);

  const key = new THREE.SpotLight(0xffe0b8, 180, 160, 0.6, 1, 1.4);
  key.position.set(-14, 16, 30);
  key.target.position.set(0, 2, 0);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffa860, 2.2);
  rim.position.set(3, 2.5, -8);
  scene.add(rim);

  const metal = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.98, 0.58, 0.16), metalness: 1, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.15 });
  metal.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
  const mirrorMetal = metal.clone();
  mirrorMetal.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
  mirrorMetal.transparent = true;
  const fade = { value: 2.5 };
  mirrorMetal.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = fade;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFadeY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFadeY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFadeY;\nuniform float uFade;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= 0.7 * pow(smoothstep(-uFade, 0.0, vFadeY), 1.6);\n#include <opaque_fragment>');
  };
  mirrorMetal.customProgramCacheKey = () => 'sim-mirror-fade';

  // Years use Playfair's lining figures (data/sim-glyphs.json), so every digit stands on the water.
  // Each text is lifted so its lowest point just clears it, and the camera frames its real height.
  const SC = 2.2;
  const cache = new Map();
  const make = (text) => {
    if (cache.has(text)) return cache.get(text);
    const { group, parts } = buildText(glyphs, text, { material: metal });
    const mirror = group.clone();
    mirror.traverse((o) => { if (o.isMesh) { o.material = mirrorMetal; o.renderOrder = 1; } });
    const box = new THREE.Box3().setFromObject(group);
    const pair = { text, group, parts, mirror, width: group.userData.width, minY: box.min.y, maxY: box.max.y };
    cache.set(text, pair);
    return pair;
  };
  const pose = (pair, rise) => {
    // rise: 0 under the water, 1 standing on it
    pair.group.scale.setScalar(SC); pair.group.position.set(0, (0.03 - pair.minY) * SC - (1 - rise) * 3.4 * SC, 0);
    pair.mirror.scale.set(SC, -SC, SC); pair.mirror.position.set(0, -pair.group.position.y, 0);
  };

  // With reduced motion the scene cuts straight to each answer, holds still, and draws only when something changes.
  const still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let shown = null, leaving = null, tChange = -10, kNow = 0.6, kTarget = 0.6, running = false, last = 0, clock = 0, dirty = true, fitW = 0, fitH = 0;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.35, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000) || 0);
    last = ts; clock += dt;
    if (still && leaving) { scene.remove(leaving.group, leaving.mirror); leaving = null; }
    kNow = still ? kTarget : kNow + (kTarget - kNow) * (1 - Math.exp(-dt * 3));
    setSky(kNow);
    scene.environment = envs[Math.round(kNow * 4)];
    key.intensity = 60 + 140 * kNow;
    const a = clock - tChange;
    if (leaving) { const u = Math.min(1, a / 0.3); pose(leaving, 1 - easeIn(u)); if (u >= 1) { scene.remove(leaving.group, leaving.mirror); leaving = null; } }
    if (shown) pose(shown, still ? 1 : a < 0.25 ? 0 : back(Math.min(1, (a - 0.25) / 0.55)));
    // frame the widest text we show, with a slow drift
    // frame the text on show, easing between sizes when the answer changes
    const wT = Math.max(shown ? shown.width : 4, 4.4) * SC, hT = shown ? (shown.maxY - shown.minY + 0.03) * SC : 3.6;
    if (!fitW || still) { fitW = wT; fitH = hT; } else { const e = 1 - Math.exp(-dt * 4); fitW += (wT - fitW) * e; fitH += (hT - fitH) * e; }
    const W = fitW, H = fitH, aspect = camera.aspect;
    const vf = (camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const d = Math.max((W * 1.3) / 2 / Math.tan(hf / 2), (H * 2.1) / 2 / Math.tan(vf / 2));
    const az = still ? 0 : Math.sin(clock * 0.08) * 0.08, el = still ? 0.035 : 0.035 + 0.01 * Math.sin(clock * 0.05), ty = 0.45 * H;
    camera.position.set(Math.sin(az) * d, ty + Math.sin(el) * d, Math.cos(az) * d);
    camera.lookAt(0, ty, 0);
    fade.value = 0.95 * SC;
    if (!still || dirty) { composer.render(); dirty = false; }
    requestAnimationFrame(frame);
  }

  // Compile every material once, with a sample year in place, so the first answer rises without a stall.
  const sample = make('2030');
  scene.add(sample.group, sample.mirror);
  pose(sample, 1);
  renderer.compile(scene, camera);
  scene.remove(sample.group, sample.mirror);

  return {
    // freedom: years from now until free (0 = now), or null for never.
    show(freedomYear, yearsAway) {
      const text = freedomYear == null ? 'NOT YET' : String(freedomYear);
      kTarget = freedomYear == null ? 0 : Math.max(0.12, 1 - yearsAway / 24); // the plan ends 24 years out, in 2050
      if (shown && shown.text === text) return;
      if (leaving) scene.remove(leaving.group, leaving.mirror);
      leaving = shown;
      shown = make(text);
      scene.add(shown.group, shown.mirror);
      pose(shown, 0);
      tChange = clock;
      dirty = true;
    },
    resize(w, h, dpr) {
      if (!(w > 0 && h > 0)) return; // no room to draw: keep the last size, never divide by zero
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    },
    start() { if (!running) { running = true; dirty = true; last = performance.now(); requestAnimationFrame(frame); } },
    stop() { running = false; },
    get running() { return running; },
  };
}
