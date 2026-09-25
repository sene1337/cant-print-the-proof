// Verse 3, "keys you can carry": an orange key on a cord turns before a full moon over a night sea.
// A callback to verse 1's cowrie on a string in front of the same moon. The moonlight on the water
// glitters as tiny hex digits: property in cyberspace, hinted.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { METALS } from '../props/coin.js';
import { loadImage, TEX, bitcoinGlyph } from '../tex.js';
import { orangeFace, canvas, canvasTex, softSprite } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, smooth } from '../util.js';

export const KEY_AT = [0, 1.0, 0];
const SEA_Y = -0.2;

function discAlpha() {
  const c = canvas(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 118, 128, 128, 128);
  gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  return canvasTex(c, { srgb: false });
}

// 16 hex glyphs in a 4 x 4 atlas, soft-edged, for the glitter.
function glyphAtlas() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.font = '700 92px "JetBrains Mono"'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,255,255,0.8)'; g.shadowBlur = 10;
  g.fillStyle = '#fff';
  '0123456789abcdef'.split('').forEach((ch, i) => g.fillText(ch, (i % 4) * 128 + 64, Math.floor(i / 4) * 128 + 68));
  return canvasTex(c, { srgb: false });
}

function buildKey(face) {
  const orange = METALS.orange;
  const metal = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(...orange.color), metalness: 1, roughness: 0.26 });
  const G = new THREE.Group();
  // bow: a ring with a medallion carrying the glyph
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 20, 80), metal);
  G.add(ring);
  const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.016, 64), [
    metal,
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(...orange.color), metalness: 1, roughness: 0.38, normalMap: face.normal, normalScale: new THREE.Vector2(1.6, 1.6), map: face.color }),
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(...orange.color), metalness: 1, roughness: 0.38, normalMap: face.normal, normalScale: new THREE.Vector2(1.6, 1.6), map: face.color }),
  ]);
  medal.rotation.set(Math.PI / 2, Math.PI / 2, 0); // the cap's UVs run sideways: turn the glyph upright
  G.add(medal);
  // loop at the top for the cord
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 12, 32), metal);
  loop.position.set(0, 0.098, 0);
  G.add(loop);
  // collar and shaft
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.022, 32), metal);
  collar.position.set(0, -0.098, 0);
  G.add(collar);
  const collar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 32), metal);
  collar2.position.set(0, -0.125, 0);
  G.add(collar2);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.23, 24), metal);
  shaft.position.set(0, -0.225, 0);
  G.add(shaft);
  // bit with teeth
  const bitShape = new THREE.Shape();
  bitShape.moveTo(0, 0); bitShape.lineTo(0.062, 0); bitShape.lineTo(0.062, -0.014); bitShape.lineTo(0.045, -0.014); bitShape.lineTo(0.045, -0.028);
  bitShape.lineTo(0.062, -0.028); bitShape.lineTo(0.062, -0.05); bitShape.lineTo(0.03, -0.05); bitShape.lineTo(0.03, -0.062); bitShape.lineTo(0, -0.062); bitShape.lineTo(0, 0);
  const bit = new THREE.Mesh(new THREE.ExtrudeGeometry(bitShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), metal);
  bit.position.set(0.004, -0.278, -0.007);
  G.add(bit);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12), metal);
  tip.position.set(0, -0.342, 0);
  G.add(tip);
  G.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: G, metal };
}

export async function verse3MoonStage(film) {
  await document.fonts.load('700 92px "JetBrains Mono"');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // The moon lives in the environment too, so the metal key reflects it.
  scene.environment = studioEnv(film.renderer, [
    { pos: [-12, 8, -46], size: [14, 14], color: [0.95, 0.97, 1], intensity: 3.0 },
    { pos: [4, 2, 6], size: [4, 3], color: [1, 0.72, 0.42], intensity: 0.7 },
    { pos: [-5, 5, 3], size: [3, 1.5], color: [1, 0.85, 0.7], intensity: 1.0 },
  ], { top: [0.03, 0.035, 0.045], horizon: [0.02, 0.022, 0.028], bottom: [0, 0, 0] });
  scene.environmentIntensity = 1.0;

  const moonDir = new THREE.Vector3(0, 0.17, -1).normalize();
  const skyU = {
    uMoonDir: { value: moonDir }, uZenith: { value: new THREE.Color(0.002, 0.003, 0.008) },
    uHorizon: { value: new THREE.Color(0.03, 0.036, 0.05) }, uGlow: { value: new THREE.Color(0.55, 0.6, 0.7) },
  };
  // Night sky, full width: a gradient to a hazy horizon, and the moon's glow in the air around it.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyU,
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uMoonDir, uZenith, uHorizon, uGlow; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.4));
        float m = max(dot(d, uMoonDir), 0.0);
        col += uGlow * (pow(m, 90.0) * 0.5 + pow(m, 14.0) * 0.07);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const moonIm = await loadImage(`${TEX.base}tex/moon.jpg`);
  const moonTex = new THREE.Texture(moonIm);
  moonTex.colorSpace = THREE.SRGBColorSpace; moonTex.anisotropy = 8; moonTex.needsUpdate = true;
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: moonTex, alphaMap: discAlpha(), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
  moon.renderOrder = -8;
  scene.add(moon);

  // The sea, full width to the horizon: dark near, catching the sky's haze far off, with a soft moon column.
  const seaU = {
    uCam: { value: new THREE.Vector3() }, uMoonDir: { value: moonDir },
    uDeep: { value: new THREE.Color(0.003, 0.004, 0.007) }, uSkyH: { value: skyU.uHorizon.value }, uGlow: { value: new THREE.Color(0.5, 0.55, 0.62) },
    uTime: { value: 0 },
  };
  const sea = new THREE.Mesh(new THREE.CircleGeometry(290, 96), new THREE.ShaderMaterial({
    uniforms: seaU,
    vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam, uMoonDir, uDeep, uSkyH, uGlow; uniform float uTime; varying vec3 vW;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 v = normalize(vW - uCam);
        float graze = pow(1.0 - clamp(-v.y * 5.0, 0.0, 1.0), 3.0);
        // small waves tilt the reflection
        float w = n(vW.xz * vec2(0.9, 3.0) + vec2(0.0, uTime * 0.4)) - 0.5;
        vec3 r = reflect(v, normalize(vec3(w * 0.06, 1.0, w * 0.18)));
        float m = max(dot(r, uMoonDir), 0.0);
        vec3 col = mix(uDeep, uSkyH, graze);
        col += uGlow * (pow(m, 60.0) * 0.35 + pow(m, 8.0) * 0.03);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  // Glitter on the moon's path, made of hex digits: sparks far off, readable only close in.
  const NG = 1400;
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NG * 3), 3));
  const gAttr = new Float32Array(NG), bAttr = new Float32Array(NG);
  for (let i = 0; i < NG; i++) gAttr[i] = Math.floor(hash1(i * 5 + 7) * 16);
  gg.setAttribute('aGlyph', new THREE.BufferAttribute(gAttr, 1));
  gg.setAttribute('aBright', new THREE.BufferAttribute(bAttr, 1));
  const glitterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAtlas: { value: glyphAtlas() }, uScale: { value: 400 }, uColor: { value: new THREE.Color(0.85, 0.88, 0.92) } },
    vertexShader: /* glsl */ `
      attribute float aGlyph, aBright; uniform float uScale; varying float vG, vB;
      void main() {
        vG = aGlyph; vB = aBright;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(0.16 * uScale / -mv.z, 1.5, 40.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform vec3 uColor; varying float vG, vB;
      void main() {
        vec2 cell = vec2(mod(vG, 4.0), floor(vG / 4.0));
        vec2 uv = (cell + vec2(gl_PointCoord.x, gl_PointCoord.y)) / 4.0;
        float a = texture2D(uAtlas, vec2(uv.x, 1.0 - uv.y)).r;
        gl_FragColor = vec4(uColor * a * vB, 1.0);
      }`,
  });
  const glitter = new THREE.Points(gg, glitterMat);
  glitter.frustumCulled = false;
  scene.add(glitter);

  // Stars, sparse, above the horizon only.
  const NS = 500;
  const sg = new THREE.BufferGeometry();
  const spos = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) {
    const a = (hash1(i * 3) - 0.5) * 2.4 - 0.2, e = 0.06 + hash1(i * 3 + 1) * 0.7;
    spos[i * 3] = Math.sin(a) * Math.cos(e) * 150; spos[i * 3 + 1] = Math.sin(e) * 150; spos[i * 3 + 2] = -Math.cos(a) * Math.cos(e) * 150;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.1, map: softSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.8, 0.85, 1).multiplyScalar(0.55), sizeAttenuation: true }));
  stars.renderOrder = -9;
  scene.add(stars);

  const face = orangeFace(bitcoinGlyph, { size: 512 });
  const key = buildKey(face);
  scene.add(key.group);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 3, 8), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.8 }));
  scene.add(cord);

  const moonLight = new THREE.DirectionalLight(0xdfe8ff, 2.4);
  scene.add(moonLight, moonLight.target);
  const warm = new THREE.PointLight(0xffa860, 0.6, 6, 2);
  scene.add(warm);

  const S = {
    scene, sky, moon, sea, glitter, stars, key, cord, moonLight, warm,
    moonAz: -14, moonEl: 10, moonSize: 15,
    fx: { bloom: 0.5, threshold: 1.0, bloomRadius: 0.5, grain: 0.05, vignette: 0.5, tint: [1.0, 1.0, 1.0] },
    update(ctx) {
      S.moonAz = -14; S.moonEl = 10; S.moonSize = 15;
      key.group.position.set(...KEY_AT);
      key.group.rotation.set(0, 0, 0);
      moonLight.intensity = 2.4;
      warm.intensity = 0.6;
      seaU.uTime.value = ctx.t;
    },
    // Hang the sky on the camera: moon, glow, sea and glitter all agree on one direction.
    place(cam, t, height = 1080) {
      const D = 80;
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
      const yaw = Math.atan2(fwd.x, -fwd.z);
      const az = yaw + (S.moonAz * Math.PI) / 180, el = (S.moonEl * Math.PI) / 180;
      const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      moonDir.copy(d);
      moon.position.copy(cam.position).addScaledVector(d, D);
      moon.lookAt(cam.position);
      const size = 2 * D * Math.tan(((S.moonSize / 2) * Math.PI) / 180);
      moon.scale.set(size, size, 1);
      sky.position.copy(cam.position);
      stars.position.copy(cam.position);
      sea.position.set(cam.position.x, SEA_Y, cam.position.z);
      seaU.uCam.value.copy(cam.position);
      // glitter band along the water from under the moon toward the camera
      const fx = d.x, fz = d.z, fl = Math.hypot(fx, fz) || 1;
      const ux = fx / fl, uz = fz / fl, px = -uz, pz = ux;
      const p = glitter.geometry.attributes.position.array, b = glitter.geometry.attributes.aBright.array;
      const tick = Math.floor(t * 7);
      for (let i = 0; i < NG; i++) {
        const h = (k) => hash1(i * 13 + k);
        const dist = 4.5 + 70 * Math.pow(h(1), 1.7);
        const width = 0.5 + dist * 0.05;
        const side = (h(2) - 0.5) * 2 * width * Math.pow(h(3), 0.7);
        p[i * 3] = cam.position.x + ux * dist + px * side;
        p[i * 3 + 1] = SEA_Y + 0.01;
        p[i * 3 + 2] = cam.position.z + uz * dist + pz * side;
        const tw = hash1(i * 31 + tick * 977);
        b[i] = tw > 0.55 ? (tw - 0.55) / 0.45 * (1 - Math.abs(side) / (width * 1.05)) * 0.9 : 0;
      }
      glitter.geometry.attributes.position.needsUpdate = true;
      glitter.geometry.attributes.aBright.needsUpdate = true;
      glitterMat.uniforms.uScale.value = height / (2 * Math.tan((cam.fov * Math.PI) / 360));
      moonLight.position.copy(key.group.position).addScaledVector(d, 30);
      moonLight.target.position.copy(key.group.position);
    },
    // The key turns on its cord; tFace is when the medallion turns square to the camera.
    hang(t, lt, tFace) {
      const g = key.group;
      g.position.set(KEY_AT[0] + Math.sin(t * 1.1) * 0.004, KEY_AT[1], KEY_AT[2]);
      g.rotation.set(0.03 * Math.sin(t * 1.7), -0.12 + (t - tFace) * 0.6, 0.04 * Math.sin(t * 1.3 + 1));
      cord.position.set(g.position.x, g.position.y + 0.105 + 1.5, g.position.z);
      warm.position.set(g.position.x + 0.5, g.position.y + 0.1, g.position.z + 0.6);
    },
  };
  return S;
}
