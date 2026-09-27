// The monument: "21,000,000" cast in solid metal. The chorus's answer to endless paper.
// Chorus 1 raises it, chorus 2 throws the storm at it, chorus 3 sets it at world scale at dawn.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { NoteCloud } from '../props/notes.js';
import { Dust } from '../props/dust.js';
import { banknote } from '../tex.js';
import { hash1, clamp } from '../util.js';

// Build extruded glyph geometry from outlines in data/glyphs.json (Playfair Display Black, OFL, lining figures).
// The bevel grows outward from the true outline: an inward bevel spikes across the face at the sharp corners of
// Playfair's 2 (the same fix as the simulator's year, js/sim/scene.js).
function glyphGeometry(g, scale, depth, bevel) {
  const path = new THREE.ShapePath();
  const s = scale / 1000;
  for (const c of g.cmds) {
    if (c[0] === 'M') path.moveTo(c[1] * s, c[2] * s);
    else if (c[0] === 'L') path.lineTo(c[1] * s, c[2] * s);
    else if (c[0] === 'Q') path.quadraticCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s);
    else if (c[0] === 'C') path.bezierCurveTo(c[1] * s, c[2] * s, c[3] * s, c[4] * s, c[5] * s, c[6] * s);
  }
  const shapes = path.toShapes(false);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: 0, bevelSegments: 4, curveSegments: 12 });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildNumerals(glyphs, text, { scale = 2.2, depth = 0.45, bevel = 0.05, material }) {
  const group = new THREE.Group();
  const parts = [];
  let x = 0;
  for (const ch of text) {
    const g = glyphs.glyphs[ch];
    const cs = ch === ',' ? 1.45 : 1;
    const mesh = new THREE.Mesh(glyphGeometry(g, scale * cs, depth, bevel), material);
    if (ch === ',') mesh.position.set(-0.04 * scale, 0.02 * scale, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.position.x = x;
    holder.userData = { ch, x0: x, w: (g.advance * scale) / 1000 };
    group.add(holder);
    parts.push(holder);
    x += (g.advance * scale) / 1000;
  }
  // centre horizontally
  for (const p of parts) { p.position.x -= x / 2; p.userData.x0 -= x / 2; }
  group.userData.width = x;
  return { group, parts };
}

const BASE = 0.62; // baseline height above the floor: comma tails hang below it

export async function monumentStage(film) {
  const glyphs = await (await fetch('./data/glyphs.json')).json();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.02);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 7, 3], size: [8, 2], color: [1, 0.85, 0.66], intensity: 2.4 },
    { pos: [-7, 1.5, 2], size: [0.6, 6], color: [1, 0.7, 0.4], intensity: 3.0 },
    { pos: [7, 1, -2], size: [0.5, 6], color: [1, 0.9, 0.8], intensity: 2.2 },
    { pos: [0, 0.5, -7], size: [10, 0.4], color: [1, 0.55, 0.2], intensity: 2.4 },
  ], { top: [0.34, 0.26, 0.18], horizon: [0.1, 0.07, 0.04], bottom: [0.01, 0.008, 0.006] });

  const metal = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.96, 0.44, 0.07), metalness: 1, roughness: 0.26, clearcoat: 0.3, clearcoatRoughness: 0.15 });
  const { group: numerals, parts } = buildNumerals(glyphs, '21,000,000', { material: metal });
  scene.add(numerals);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(400, 96), new THREE.MeshPhysicalMaterial({ color: 0x060504, roughness: 0.55, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.3, envMapIntensity: 0.04 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const key = new THREE.SpotLight(0xffe0b8, 60, 60, 0.5, 0.7, 1.4);
  key.position.set(-5, 9, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff8a3a, 2.2);
  rim.position.set(4, 3, -6);
  scene.add(rim);
  // A light that sweeps across the face on "That's the truth".
  const sweep = new THREE.SpotLight(0xfff0d8, 0, 40, 0.18, 0.6, 1.2);
  scene.add(sweep, sweep.target);

  // Dawn, for the last chorus: a sky from deep blue to an orange horizon, the sun rising behind the numerals,
  // and wet ground that mirrors it all. The sky is drawn per pixel; below the horizon it mirrors itself.
  const v3 = (x, y, z) => ({ value: new THREE.Vector3(x, y, z) });
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSun: v3(0.16, 0.02, -1), uGlow: { value: 1 }, uStars: { value: 0 },
      uZ: v3(0, 0, 0), uM: v3(0, 0, 0), uHs: v3(0, 0, 0), uHa: v3(0, 0, 0), uSunCol: v3(1, 0.62, 0.3),
    },
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
        float s = max(0.0, dot(d, uSun));
        c += uSunCol * (pow(s, 5000.0) * 3.2 + pow(s, 400.0) * 0.3 + pow(s, 24.0) * 0.07) * uGlow;
        float st = step(0.9982, hash3(floor(d * 900.0))) * smoothstep(0.06, 0.3, d.y) * uStars;
        c += vec3(0.75, 0.82, 1.0) * st * 0.8;
        c *= mix(1.0, 0.5, below);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  // Three skies for the three choruses, over the same wet ground: night with a low moon, a red storm, and dawn.
  const MODES = {
    night: { uZ: [0.001, 0.002, 0.008], uM: [0.006, 0.01, 0.03], uHs: [0.06, 0.08, 0.14], uHa: [0.02, 0.025, 0.05], uSunCol: [0.7, 0.78, 1.0], sunX: -0.22, sunEl: [0.05, 0.06], glow: [0.55, 0.55], stars: 1 },
    // (the storm's reds keep some green and blue in them: pure saturated red trips the red-flash rule when notes cross it)
    storm: { uZ: [0.012, 0.005, 0.005], uM: [0.06, 0.018, 0.015], uHs: [0.34, 0.1, 0.07], uHa: [0.12, 0.035, 0.03], uSunCol: [1.0, 0.45, 0.3], sunX: 0.1, sunEl: [0.03, 0.03], glow: [0.45, 0.45], stars: 0 },
    dawn: { uZ: [0.004, 0.009, 0.035], uM: [0.09, 0.05, 0.11], uHs: [0.75, 0.27, 0.07], uHa: [0.12, 0.06, 0.08], uSunCol: [1.0, 0.62, 0.3], sunX: 0.16, sunEl: [0.012, 0.082], glow: [0.8, 1.3], stars: 0 },
  };
  const setSky = (mode, k) => {
    const P = MODES[mode], U = skyMat.uniforms;
    for (const key of ['uZ', 'uM', 'uHs', 'uHa', 'uSunCol']) U[key].value.set(...P[key]);
    U.uStars.value = P.stars;
    U.uSun.value.set(P.sunX, P.sunEl[0] + (P.sunEl[1] - P.sunEl[0]) * k, -1).normalize();
    U.uGlow.value = P.glow[0] + (P.glow[1] - P.glow[0]) * k;
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  // The metal reflects the dawn sky rather than the studio.
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), skyMat));
  // A broad soft panel behind the camera, seen only in reflections: it gives the metal's faces a sheen under dark skies.
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const fillPanel = new THREE.Mesh(new THREE.PlaneGeometry(70, 16), fillMat);
  fillPanel.position.set(0, 7, 30);
  fillPanel.lookAt(0, 2, 0);
  envScene.add(fillPanel);
  const FILL = { night: [0.34, 0.4, 0.55], storm: [0.55, 0.2, 0.14], dawn: [0.2, 0.14, 0.1] };
  const pmrem = new THREE.PMREMGenerator(film.renderer);
  const envs = {};
  for (const mode of Object.keys(MODES)) { setSky(mode, 0.5); fillMat.color.setRGB(...FILL[mode]); envs[mode] = pmrem.fromScene(envScene, 0.02, 0.1, 200).texture; }
  pmrem.dispose();
  const studio = scene.environment;
  // Wet ground: dark near the camera, a mirror toward the horizon (Fresnel).
  const wetMat = new THREE.MeshPhysicalMaterial({ color: 0x080605, roughness: 0.6, metalness: 0, specularIntensity: 0.06, transparent: true, depthWrite: true, envMapIntensity: 0.0 });
  wetMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 3.0);
      diffuseColor.a = mix(0.93, 0.42, fres);
      #include <opaque_fragment>`);
  };
  wetMat.customProgramCacheKey = () => 'dawn-wet-ground';
  const wet = new THREE.Mesh(new THREE.CircleGeometry(400, 96), wetMat);
  wet.rotation.x = -Math.PI / 2;
  wet.receiveShadow = true;
  scene.add(wet);
  // The numerals' reflection: a mirrored copy under the wet ground.
  film.renderer.localClippingEnabled = true;
  metal.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)]; // nothing shows below the ground
  const mirrorMetal = metal.clone();
  mirrorMetal.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)]; // reflections only below it
  // The reflection fades with depth, so it reads as wet ground, not as a second row of upside-down digits.
  const fade = { value: 1.4 }, ripple = { value: 0 };
  mirrorMetal.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = fade;
    sh.uniforms.uTime = ripple;
    // a slow ripple that grows with depth, so it reads as water
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFadeY;\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wp0 = modelMatrix * vec4(transformed, 1.0);\ntransformed.x += sin(wp0.y * 4.0 + uTime * 1.1) * 0.05 * max(0.0, -wp0.y) / max(0.2, length(modelMatrix[0].xyz));')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFadeY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFadeY;\nuniform float uFade;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= 0.7 * pow(smoothstep(-uFade, 0.0, vFadeY), 1.6);\n#include <opaque_fragment>');
  };
  mirrorMetal.customProgramCacheKey = () => 'monument-mirror-fade';
  mirrorMetal.transparent = true; // it fades into the reflected sky, not into black
  const mirror = numerals.clone();
  mirror.traverse((o) => { if (o.isMesh) { o.material = mirrorMetal; o.castShadow = false; o.receiveShadow = false; o.renderOrder = 1; } });
  wet.renderOrder = 2; // the wet ground draws over the reflection beneath it
  scene.add(mirror);
  // Kept for older shots that ask for it; the dawn sun is drawn by the sky itself.
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = sunCanvas.height = 8;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunCanvas), transparent: true, opacity: 0 }));
  const dawnLight = new THREE.DirectionalLight(0xffa860, 0);
  dawnLight.position.set(0, 2, -10);
  scene.add(dawnLight);

  const cloud = new NoteCloud(await banknote({ seed: 17 }), 2600, { emissive: 0.06 });
  scene.add(cloud);
  const dust = new Dust({ count: 900, size: 0.02, box: [16, 6, 12], color: [1, 0.75, 0.45], gain: 0.9 });
  scene.add(dust);

  return {
    BASE, scene, numerals, parts, metal, floor, key, rim, sweep, sky, sun, dawnLight, cloud, dust, wet, mirror,
    // An open sky over wet ground that mirrors the number. mode: night | storm | dawn; k: 0..1 through the shot.
    // Call syncMirror() after posing the numerals.
    sky(mode, k = 0) {
      setSky(mode, k);
      // under red or orange light the orange metal turns a saturated red; a golder metal keeps it off the red-flash line
      if (mode === 'storm') metal.color.setRGB(0.95, 0.6, 0.2);
      if (mode === 'dawn') metal.color.setRGB(0.98, 0.58, 0.16);
      sky.visible = true;
      scene.environment = envs[mode];
      floor.visible = false;
      wet.visible = true;
      mirror.visible = true;
      scene.fog.density = 0;
    },
    dawn(k, sc) { this.sky('dawn', k); this.syncMirror(); },
    // The reflection copies the numerals' pose, flipped about the waterline.
    syncMirror() {
      mirror.position.set(numerals.position.x, -numerals.position.y, numerals.position.z);
      mirror.rotation.copy(numerals.rotation);
      mirror.scale.set(numerals.scale.x, -numerals.scale.y, numerals.scale.z);
      mirror.children.forEach((m, i) => { const p = parts[i]; m.position.copy(p.position); m.rotation.copy(p.rotation); m.scale.copy(p.scale); m.visible = p.visible; });
      mirrorMetal.roughness = metal.roughness;
      mirrorMetal.color.copy(metal.color);
      fade.value = 0.95 * numerals.scale.y;
    },
    fx: { bloom: 0.45, threshold: 1.0, bloomRadius: 0.45, grain: 0.04, vignette: 0.45, tint: [1.02, 0.99, 0.95] },
    update(ctx) {
      numerals.visible = true;
      metal.roughness = 0.26;
      metal.color.setRGB(0.96, 0.44, 0.07);
      numerals.position.set(0, BASE, 0);
      numerals.rotation.set(0, 0, 0);
      numerals.scale.setScalar(1);
      for (const p of parts) { p.position.set(p.userData.x0, 0, 0); p.rotation.set(0, 0, 0); p.scale.setScalar(1); p.visible = true; }
      floor.visible = true;
      floor.material.clearcoat = 0.15; floor.material.color.set(0x060504); floor.material.roughness = 0.55;
      key.position.set(-5, 9, 9); key.target.position.set(0, 1, 0); key.intensity = 60; key.distance = 60; key.angle = 0.5; key.penumbra = 0.7;
      rim.intensity = 2.2; rim.color.set(0xff8a3a); rim.position.set(4, 3, -6);
      sweep.intensity = 0;
      sky.visible = false; sun.visible = false; dawnLight.intensity = 0;
      wet.visible = false; mirror.visible = false; scene.environment = studio;
      scene.fog.density = 0.02;
      scene.background.set(0x000000);
      scene.environmentIntensity = 1.0;
      cloud.visible = false;
      dust.visible = true;
      dust.setTime(ctx.t);
      ripple.value = ctx.t;
    },
    // Chorus 2's gale: paper blowing right to left behind the number, and a little skimming low over the ground.
    gale(t, { n = 220, speed = 3.2 } = {}) {
      cloud.visible = true;
      cloud.setTime(t);
      cloud.setFlutter(0.8);
      const W = numerals.userData.width * numerals.scale.x, L = W * 3;
      cloud.layout(n, (i, d) => {
        const r1 = hash1(i * 5 + 1), r2 = hash1(i * 5 + 2), r3 = hash1(i * 5 + 3), r4 = hash1(i * 5 + 4);
        const x = L / 2 - ((r1 * L + t * speed * (0.7 + r4 * 0.6)) % L);
        const front = i % 6 === 0;
        d.position.set(x, front ? 0.05 + r3 * 0.22 : 0.3 + r3 * 5.5, front ? 1.2 + r2 * 2.5 : -2.5 - r2 * 10);
        d.rotation.set(Math.sin(t * 0.9 + i) * 0.9 + r1 * 6, t * (0.4 + r2 * 0.6) + r3 * 6, Math.sin(t * 0.7 + r4 * 9) * 0.6);
        d.scale.setScalar(front ? 0.22 : 0.3);
      });
    },
    // Lay out the storm hitting the numerals: notes fly in from the camera side, strike, and fall.
    storm(t, t0, { n = 900, speed = 9, spread = 7 } = {}) {
      cloud.visible = true;
      cloud.setTime(t);
      cloud.setFlutter(1);
      const W = numerals.userData.width;
      cloud.layout(n, (i, d) => {
        const r1 = hash1(i * 5 + 1), r2 = hash1(i * 5 + 2), r3 = hash1(i * 5 + 3), r4 = hash1(i * 5 + 4);
        const born = t0 + r1 * 2.6;
        const a = t - born;
        if (a < 0) return false;
        const x = (r2 - 0.5) * (W + 2), y = BASE + 0.1 + r3 * 1.6;
        const z0 = 9 + r4 * spread;
        const hitT = (z0 - 0.4) / speed;
        let z, yy = y, xx = x, rx, ry, rz;
        if (a < hitT) { z = z0 - speed * a; rx = a * 5 + i; ry = a * 3; rz = a * 2 + i; }
        else {
          const b = a - hitT; // after the hit: stop, slide down, flutter off to the side
          z = 0.4 + b * 0.8; yy = Math.max(0.02, y - 4.9 * b * b); xx = x + (r2 - 0.5) * b * 3;
          rx = hitT * 5 + i + b * 2; ry = hitT * 3 + b; rz = hitT * 2 + i + b * 4;
        }
        d.position.set(xx, yy, z);
        d.rotation.set(rx, ry, rz);
        d.scale.setScalar(0.26);
      });
    },
  };
}
