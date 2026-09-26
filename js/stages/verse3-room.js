// Verse 3, "the very next day": an old CRT monitor in a dark room types "Running bitcoin".
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { canvas, canvasTex } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, rng } from '../util.js';

export const LINE = 'Running bitcoin';
const TW = 1024, TH = 768;
const FONT_PX = 96;

// The text, drawn once; the shader reveals it one character at a time.
function textTexture() {
  const c = canvas(TW, TH), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH);
  g.font = `500 ${FONT_PX}px "JetBrains Mono"`;
  g.textBaseline = 'middle'; g.textAlign = 'left';
  const cw = g.measureText('M').width;
  const x0 = (TW - cw * LINE.length) / 2;
  g.shadowColor = 'rgba(255,220,170,0.9)'; g.shadowBlur = 14;
  g.fillStyle = '#f4ead6';
  for (let i = 0; i < LINE.length; i++) g.fillText(LINE[i], x0 + i * cw, TH * 0.5);
  return { tex: canvasTex(c, { aniso: 8 }), x0: x0 / TW, cw: cw / TW };
}

function keyboardTexture() {
  const c = canvas(1024, 320), g = c.getContext('2d');
  g.fillStyle = '#b9b09a'; g.fillRect(0, 0, 1024, 320);
  const R = rng(4);
  for (let row = 0; row < 5; row++) {
    let x = 18 + row * 14;
    while (x < 1000) {
      const w = row === 4 && x > 300 && x < 400 ? 340 : 52 + (R() < 0.1 ? 30 : 0);
      g.fillStyle = '#d8d0bc'; g.fillRect(x, 16 + row * 60, w - 8, 50);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 60 + row * 60, w - 8, 6);
      x += w;
    }
  }
  return canvasTex(c);
}

export async function verse3RoomStage(film) {
  await document.fonts.load(`500 ${FONT_PX}px "JetBrains Mono"`);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.FogExp2(0x020203, 0.035);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 1, 6], size: [3, 2], color: [1, 0.85, 0.65], intensity: 0.8 },
    { pos: [-6, 3, -1], size: [1.5, 3], color: [0.55, 0.7, 1], intensity: 0.6 },
  ], { top: [0.02, 0.02, 0.025], horizon: [0.01, 0.01, 0.012], bottom: [0, 0, 0] });
  scene.environmentIntensity = 0.6;

  // The only lights: the screen's glow, and a cold streak of night from a window.
  const glow = new THREE.SpotLight(0xffd9a8, 9, 12, 1.1, 1.0, 2);
  glow.position.set(0, 1.05, 0.55);
  glow.target.position.set(0, 0.2, 3);
  scene.add(glow, glow.target);
  const night = new THREE.DirectionalLight(0x8fb0ff, 0.7);
  night.position.set(-4, 3.5, -1.5);
  scene.add(night);
  // Moonlight through venetian blinds, from a window off to the left: stripes on the wall and desk.
  const blindsTex = (() => {
    const c = canvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
    const gr = g.createRadialGradient(256, 256, 40, 256, 256, 250);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    for (let y = 30; y < 480; y += 34) g.fillRect(40, y, 432, 20);
    g.fillStyle = '#000'; g.fillRect(250, 0, 12, 512); // the window's mullion
    return canvasTex(c);
  })();
  const blinds = new THREE.SpotLight(0x9fb8ff, 70, 30, 0.42, 0.25, 1.2);
  blinds.position.set(-5.5, 3.6, 2.6);
  blinds.target.position.set(0.6, 0.9, -2.2);
  blinds.map = blindsTex;
  scene.add(blinds, blinds.target);
  // the back wall of the room, so the monitor sits in a place, not a void
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshStandardMaterial({ color: 0x6b6f7a, roughness: 0.92, metalness: 0 }));
  wall.position.set(0, 1.8, -2.3);
  wall.receiveShadow = true;
  scene.add(wall);
  // the tube's own glow falling back on the bezel and the desk
  const spill = new THREE.PointLight(0xffe0b8, 1.6, 4, 2);
  spill.position.set(1.3, 0.45, 0.9);
  scene.add(spill);

  // Desk.
  const desk = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 3.2), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.45, metalness: 0 }));
  desk.position.set(0, -0.05, 0.6);
  desk.receiveShadow = true;
  scene.add(desk);

  // The CRT: beige plastic shell, a deep tapered back, a curved glass tube.
  const plastic = new THREE.MeshStandardMaterial({ color: 0xc9bfa6, roughness: 0.62, metalness: 0 });
  const crt = new THREE.Group();
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.72, 1.42, 0.26, 4, 0.06), plastic);
  bezel.position.set(0, 1.0, 0.1);
  crt.add(bezel);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 1.0, 1.1, 4, 1), plastic);
  back.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  back.scale.set(1.0, 1, 0.82);
  back.position.set(0, 1.0, -0.58);
  crt.add(back);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), plastic);
  neck.position.set(0, 0.24, -0.1);
  crt.add(neck);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.06, 40), plastic);
  foot.position.set(0, 0.03, -0.1);
  crt.add(foot);
  // recess around the tube
  const recess = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x0b0b0a, roughness: 0.8 }));
  recess.position.set(0, 1.02, 0.232);
  crt.add(recess);
  // power LED
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1, 0.35).multiplyScalar(2) }));
  led.position.set(0.7, 0.36, 0.235);
  crt.add(led);

  // The tube: a bulged plane with the typing shader.
  const { tex: textTex, x0, cw } = textTexture();
  const screenGeo = new THREE.PlaneGeometry(1.36, 1.02, 32, 24);
  {
    const p = screenGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / 0.68, y = p.getY(i) / 0.51;
      p.setZ(i, 0.05 * (1 - x * x * 0.6) * (1 - y * y * 0.6));
    }
    screenGeo.computeVertexNormals();
  }
  const screenMat = new THREE.ShaderMaterial({
    uniforms: {
      uText: { value: textTex }, uN: { value: 0 }, uCursor: { value: 1 }, uX0: { value: x0 }, uCW: { value: cw },
      uTime: { value: 0 }, uGain: { value: 1.6 }, uFlick: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uText; uniform float uN, uCursor, uX0, uCW, uTime, uGain, uFlick;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        vec3 txt = texture2D(uText, uv).rgb;
        float shown = step(uv.x, uX0 + uN * uCW);
        vec3 col = vec3(0.012, 0.016, 0.013) + txt * shown * 1.15;
        float cx0 = uX0 + uN * uCW + uCW * 0.08, cx1 = cx0 + uCW * 0.9;
        float cur = step(cx0, uv.x) * step(uv.x, cx1) * step(0.42, uv.y) * step(uv.y, 0.58) * uCursor;
        vec2 cc = vec2((cx0 + cx1) * 0.5, 0.5);
        float halo = exp(-length((uv - cc) * vec2(9.0, 7.0)) * 3.0) * uCursor;
        col = mix(col, vec3(1.0, 0.52, 0.1) * 2.0, cur);
        col += vec3(1.0, 0.45, 0.08) * halo * 0.35;
        col *= 0.8 + 0.2 * sin(uv.y * 768.0 * 3.14159);
        vec2 d = uv - 0.5;
        col *= 1.0 - dot(d * vec2(1.0, 1.2), d * vec2(1.0, 1.2)) * 1.3;
        col += vec3(0.02, 0.025, 0.022) * (1.0 - dot(d, d) * 2.0);
        col *= 1.0 - uFlick;
        gl_FragColor = vec4(col * uGain, 1.0);
      }`,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.02, 0.235);
  crt.add(screen);
  // glass: a faint reflective layer over the tube
  const glass = new THREE.Mesh(screenGeo, new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.18, clearcoat: 0.4, envMapIntensity: 1.2 }));
  glass.position.set(0, 1.02, 0.24);
  crt.add(glass);
  crt.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(crt);

  // Keyboard in front.
  const kb = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.52), [plastic, plastic, new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.6 }), plastic, plastic, plastic]);
  kb.position.set(0.05, 0.03, 1.05);
  kb.rotation.y = -0.04;
  scene.add(kb);
  // A mug, for scale and company.
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.26, 32), new THREE.MeshStandardMaterial({ color: 0x3b3833, roughness: 0.5 }));
  mug.position.set(1.15, 0.13, 0.95);
  scene.add(mug);

  const S = {
    scene, crt, screen, screenMat, glow, night, desk, kb,
    fx: { bloom: 0.55, threshold: 0.95, bloomRadius: 0.5, grain: 0.06, vignette: 0.6, tint: [1.02, 0.99, 0.95] },
    update(ctx) {
      screenMat.uniforms.uTime.value = ctx.t;
      screenMat.uniforms.uN.value = LINE.length;
      screenMat.uniforms.uCursor.value = 1;
      screenMat.uniforms.uFlick.value = 0;
      glow.intensity = 9;
    },
    // times: per-character song times; cursor blinks after the last one.
    type(t, times) {
      let n = 0;
      for (const x of times) if (t >= x) n++;
      screenMat.uniforms.uN.value = n;
      const since = n ? t - times[n - 1] : t - times[0];
      const typing = n < times.length && n > 0;
      screenMat.uniforms.uCursor.value = typing || n === 0 ? 1 : (Math.floor(since / 0.5) % 2 === 0 ? 1 : 0);
      // the tube flickers a hair, as they did
      screenMat.uniforms.uFlick.value = 0;
      glow.intensity = 9 + n * 0.15;
    },
  };
  return S;
}
