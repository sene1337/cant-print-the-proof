// VERSE 2 1971: a dark living room lit only by a wood-cabinet TV. On screen, a window full of gold light.
// A shutter slams over it on "closed", and the picture and the room go cold blue.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { Dust } from '../props/dust.js';
import { clamp, lerp, hash1, rng } from '../util.js';
import { clampHot, canvas2d, canvasTex } from '../props/verse2-kit.js';

export const SCREEN = { x: -0.2, y: 1.02, z: 0.52, w: 1.0, h: 0.76 };

function walnut(w = 512, h = 512, seed = 3) {
  const [c, g] = canvas2d(w, h);
  const R = rng(seed);
  g.fillStyle = '#3b1f10'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 200; i++) {
    const y = R() * h, a = 0.05 + R() * 0.12;
    g.strokeStyle = R() < 0.5 ? `rgba(20,8,3,${a})` : `rgba(120,64,30,${a})`;
    g.lineWidth = 1 + R() * 3;
    g.beginPath();
    for (let x = 0; x <= w; x += 12) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 5 + Math.sin(x * 0.037 + i * 2) * 2);
    g.stroke();
  }
  return canvasTex(c);
}

function panelling() {
  const w = 1024, h = 512;
  const [c, g] = canvas2d(w, h);
  const R = rng(5);
  g.fillStyle = '#2d1a0e'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 64) {
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = `rgba(${R() < 0.5 ? '15,7,3' : '90,52,26'},${0.08 + R() * 0.1})`;
      g.lineWidth = 1 + R() * 2;
      const xx = x + R() * 64;
      g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx + (R() - 0.5) * 6, h); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x, 0, 3, h);
  }
  return canvasTex(c, { repeat: true });
}

function grille() {
  const [c, g] = canvas2d(256, 256);
  g.fillStyle = '#2a2320'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) {
    g.fillStyle = 'rgba(80,68,58,0.35)'; g.fillRect(i, 0, 2, 256); g.fillRect(0, i, 256, 2);
  }
  return canvasTex(c);
}

// Page-a-day wall calendar, lettered big enough to read on a phone.
function calendar() {
  const w = 512, h = 680;
  const [c, g] = canvas2d(w, h);
  g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#a3261c'; g.fillRect(0, 0, w, 168);
  g.fillStyle = '#f7f0e3'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 58px "Figtree"';
  g.fillText('AUGUST', w / 2, 58);
  g.font = '800 72px "Figtree"';
  g.fillText('1971', w / 2, 124);
  g.fillStyle = '#1c1916';
  g.font = '900 300px "Playfair Display"';
  g.fillText('15', w / 2, 368);
  g.fillStyle = '#a3261c';
  g.font = '800 104px "Figtree"';
  g.fillText('SUNDAY', w / 2, 590);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
  for (let x = 30; x < w; x += 38) { g.beginPath(); g.arc(x, 8, 6, 0, Math.PI * 2); g.stroke(); }
  return canvasTex(c);
}

function screenMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 1 }, uShut: { value: 0 }, uCold: { value: 0 }, uGain: { value: 1 }, uLeak: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime, uOn, uShut, uCold, uGain, uLeak;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float rrect(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      float inBand(float x, float a, float b) { return step(a, x) * step(x, b); }
      vec3 picture(vec2 uv) {
        // a dark room wall with faint wallpaper stripes
        vec3 col = vec3(0.065, 0.042, 0.028) * (0.88 + 0.12 * step(0.5, fract(uv.x * 36.0)));
        vec2 w0 = vec2(0.34, 0.17), w1 = vec2(0.66, 0.85);
        vec2 wc = 0.5 * (w0 + w1), wh = 0.5 * (w1 - w0);
        vec2 d = (uv - wc) / wh;
        float inGlass = step(abs(d.x), 1.0) * step(abs(d.y), 1.0);
        float inFrame = step(abs(d.x), 1.13) * step(abs(d.y), 1.09) * (1.0 - inGlass);
        // gold light behind the glass, hottest in the middle
        float r = length(d * vec2(1.0, 0.75));
        vec3 gold = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.82, 0.45), smoothstep(1.0, 0.0, r)) * 1.3;
        float mull = max(step(abs(uv.x - wc.x), 0.009), step(abs(uv.y - (wc.y + 0.1)), 0.009));
        vec3 glass = mix(gold, vec3(0.1, 0.06, 0.035), mull);
        // two louvered shutters swing in from the sides and meet in the middle
        float sh = uShut;
        float px = abs(d.x);
        float cover = step(1.0 - sh, px) * inGlass;
        float lx = clamp((px - (1.0 - sh)) / max(sh, 0.001), 0.0, 1.0);   // 0 at the leading edge .. 1 at the hinge
        float sy = fract((d.y + 1.0) * 8.0);
        float louver = mix(0.44, 0.16, smoothstep(0.05, 0.82, sy));
        float gapL = step(0.84, sy);
        float stile = max(step(0.9, lx), step(lx, 0.1)) + step(0.94, abs(d.y));
        stile = clamp(stile, 0.0, 1.0);
        vec3 wood = vec3(0.46, 0.29, 0.15);
        vec3 panel = wood * mix(louver * (1.0 - 0.75 * gapL), 0.4, stile);
        panel += gold * gapL * (1.0 - stile) * uLeak * 0.75;          // light leaking through the slats
        panel *= 1.0 - 0.45 * smoothstep(0.12, 0.0, lx) * step(0.02, 1.0 - sh); // the leading edge in shadow
        // the swinging shutters throw a shadow onto the glass beside them
        float edgeGap = (1.0 - sh) - px;
        glass *= 1.0 - 0.65 * smoothstep(0.22, 0.0, edgeGap) * step(0.0, edgeGap) * step(0.01, sh);
        vec3 win = mix(glass, panel, cover);
        // curtains, the frame, the sill; warm spill on the wall until the light is cut off
        float open = 1.0 - sh;
        float spill = exp(-max(0.0, max(abs(d.x) - 1.0, abs(d.y) - 1.0)) * 3.5) * (0.38 * open + 0.05 * uLeak);
        col += vec3(1.0, 0.58, 0.2) * spill;
        float curt = max(inBand(uv.x, 0.13, 0.29), inBand(uv.x, 0.71, 0.87)) * inBand(uv.y, 0.06, 0.95);
        float fold = 0.5 + 0.5 * sin(uv.x * 150.0);
        vec3 curtain = vec3(0.34, 0.06, 0.045) * (0.45 + 0.55 * fold) * (0.35 + 1.6 * spill);
        col = mix(col, curtain, curt);
        col = mix(col, vec3(0.2, 0.12, 0.07) * (0.6 + 1.2 * spill), inFrame);
        float sill = inBand(uv.x, w0.x - 0.05, w1.x + 0.05) * inBand(uv.y, w0.y - 0.07, w0.y - 0.035);
        col = mix(col, vec3(0.36, 0.24, 0.14) * (0.5 + 1.4 * spill), sill);
        col = mix(col, win, inGlass);
        // the room goes cold: the picture stays, washed in blue
        float l = dot(col, vec3(0.3, 0.55, 0.15));
        vec3 cold = vec3(0.07, 0.13, 0.3) * (0.75 + 0.25 * uv.y) + vec3(0.3, 0.45, 0.85) * l * 0.9;
        return mix(col, cold, uCold);
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float m = rrect(p, vec2(1.0), 0.2);
        if (m > 0.0) discard;
        vec2 q = p * (1.0 + 0.05 * dot(p, p));
        vec2 uv = q * 0.5 + 0.5;
        vec3 col = picture(uv);
        float scan = 0.84 + 0.16 * sin(uv.y * 760.0);
        float n = hash(floor(uv * vec2(420.0, 320.0)) + floor(uTime * 30.0)) - 0.5;
        col = col * scan + n * 0.05;
        col *= 0.96 + 0.04 * sin(uTime * 55.0);
        // CRT turn-on: a bright line that opens into the picture
        float band = 1.0 - smoothstep(uOn - 0.02, uOn + 0.02, abs(p.y));
        float line = exp(-abs(p.y) * 60.0) * (1.0 - smoothstep(0.1, 0.5, uOn)) * step(0.0005, uOn) * 4.0;
        col = col * band + vec3(0.85, 0.92, 1.0) * line;
        col *= mix(0.4, 1.0, smoothstep(0.0, -0.3, m));
        gl_FragColor = vec4(col * uGain, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export async function tvStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010102);
  scene.environment = studioEnv(film.renderer, [
    { pos: [-0.2, 1, 5], size: [1.2, 1], color: [1, 0.7, 0.35], intensity: 1.2 },
  ], { top: [0.01, 0.01, 0.012], horizon: [0.004, 0.004, 0.005], bottom: [0, 0, 0] });
  scene.environmentIntensity = 1.0;

  // TV set.
  const tv = new THREE.Group();
  scene.add(tv);
  const cabMat = new THREE.MeshPhysicalMaterial({ map: walnut(), roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const cab = new THREE.Mesh(new RoundedBoxGeometry(1.62, 1.12, 1.0, 4, 0.07), cabMat);
  cab.position.set(0, 1.0, 0);
  cab.receiveShadow = true; // no shadow: the tube's light stands in for the whole glowing screen
  tv.add(cab);
  const plastic = clampHot(new THREE.MeshPhysicalMaterial({ color: 0x0c0b0a, roughness: 0.35, clearcoat: 1 }), 3);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.14, 0.9, 0.06, 4, 0.1), plastic);
  bezel.position.set(SCREEN.x, SCREEN.y, 0.49);
  tv.add(bezel);
  const scrGeo = new THREE.PlaneGeometry(SCREEN.w, SCREEN.h, 32, 24);
  {
    const p = scrGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (SCREEN.w / 2), y = p.getY(i) / (SCREEN.h / 2);
      p.setZ(i, 0.045 * (1 - 0.5 * (x * x + y * y)));
    }
    scrGeo.computeVertexNormals();
  }
  const scrMat = screenMaterial();
  const screen = new THREE.Mesh(scrGeo, scrMat);
  screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
  tv.add(screen);
  const grilleMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.46), new THREE.MeshStandardMaterial({ map: grille(), roughness: 0.9 }));
  grilleMesh.position.set(0.57, 0.86, 0.505);
  tv.add(grilleMesh);
  const chrome = clampHot(new THREE.MeshPhysicalMaterial({ color: 0xd0d0d0, metalness: 1, roughness: 0.2 }), 3);
  for (const [y, r] of [[1.36, 0.075], [1.16, 0.06]]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 32), chrome);
    k.rotation.x = Math.PI / 2;
    k.position.set(0.57, y, 0.53);
    tv.add(k);
  }
  // splayed legs
  const legMat = new THREE.MeshPhysicalMaterial({ color: 0x2a150a, roughness: 0.5 });
  for (const [x, z] of [[-0.68, 0.36], [0.68, 0.36], [-0.68, -0.36], [0.68, -0.36]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.018, 0.5, 12), legMat);
    leg.position.set(x * 1.04, 0.22, z * 1.04);
    leg.rotation.set(z * 0.35, 0, -x * 0.25);
    tv.add(leg);
  }
  // rabbit-ear antenna
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), plastic);
  base.position.set(0.1, 1.56, -0.1);
  tv.add(base);
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.95, 8), chrome);
    rod.geometry.translate(0, 0.475, 0);
    rod.position.set(0.1, 1.6, -0.1);
    rod.rotation.set(-0.25, 0, s * 0.5);
    tv.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), chrome);
    tip.position.set(0.1 - s * Math.sin(0.5) * 0.95, 1.6 + Math.cos(0.5) * Math.cos(0.25) * 0.95, -0.1 - Math.sin(0.25) * 0.95 * Math.cos(0.5));
    tv.add(tip);
  }

  // Room.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x1b1310, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshStandardMaterial({ color: 0x3a1c0c, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.4, 0.004, 2.0);
  scene.add(rug);
  const pan = panelling();
  pan.repeat.set(3, 1);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), new THREE.MeshStandardMaterial({ map: pan, roughness: 0.7 }));
  back.position.set(0, 2, -0.9);
  back.receiveShadow = true;
  scene.add(back);
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.83), new THREE.MeshStandardMaterial({ map: calendar(), roughness: 0.8 }));
  cal.position.set(1.66, 1.74, -0.88);
  scene.add(cal);
  // a small warm lamp off to the right, so the calendar reads even before the set warms up
  const calLamp = new THREE.SpotLight(0xffc98a, 0, 6, 0.45, 0.8, 2);
  calLamp.position.set(2.6, 2.4, 0.6);
  calLamp.target.position.set(1.66, 1.74, -0.88);
  scene.add(calLamp, calLamp.target);

  // Armchair back in the foreground, a silhouette against the glow.
  const fabric = new THREE.MeshStandardMaterial({ color: 0x2b1c16, roughness: 0.95 });
  const chair = new THREE.Group();
  const seatBack = new THREE.Mesh(new RoundedBoxGeometry(1.05, 1.1, 0.32, 5, 0.14), fabric);
  seatBack.position.set(0, 0.95, 0);
  chair.add(seatBack);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.72, 0.95, 4, 0.1), fabric);
    arm.position.set(s * 0.55, 0.62, -0.42);
    chair.add(arm);
  }
  chair.position.set(-1.75, 0, 2.9);
  chair.rotation.y = 0.3;
  chair.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(chair);

  // Light from the tube, and a faint blue night fill.
  const glow = new THREE.PointLight(0xffb060, 12, 10, 2);
  glow.position.set(SCREEN.x, SCREEN.y, 1.0);
  scene.add(glow);
  const night = new THREE.DirectionalLight(0x4a5f8a, 0.12);
  night.position.set(-4, 3, 3);
  scene.add(night);

  const dust = new Dust({ count: 500, size: 0.008, box: [5, 3, 5], color: [1, 0.85, 0.65], gain: 0.5 });
  dust.position.set(-0.3, 1.5, 2.2);
  scene.add(dust);

  const GOLD = new THREE.Color(1, 0.66, 0.3), BLUE = new THREE.Color(0.35, 0.55, 1.0);
  const S = {
    scene, tv, screen, scrMat, glow, night, chair, cal, calLamp, dust,
    fx: { bloom: 0.7, threshold: 0.9, bloomRadius: 0.5, grain: 0.06, vignette: 0.6, tint: [1.0, 0.98, 0.96] },

    // on: CRT turn-on 0..1; shut: shutter 0..1; cold: picture and room going blue 0..1.
    tvAt(t, { on = 1, shut = 0, cold = 0, leak = 1 } = {}) {
      const U = scrMat.uniforms;
      U.uTime.value = t; U.uOn.value = on; U.uShut.value = shut; U.uCold.value = cold; U.uLeak.value = leak;
      const bright = on * lerp(1, 0.55, cold) * lerp(1, 0.75, shut * (1 - cold));
      glow.color.copy(GOLD).lerp(BLUE, cold);
      glow.intensity = 12 * bright * (0.94 + 0.06 * Math.sin(t * 55));
      night.intensity = lerp(0.12, 0.22, cold);
    },

    update(ctx) {
      S.tvAt(ctx.t);
      calLamp.intensity = 0;
      dust.visible = true;
      dust.setTime(ctx.t, [0.01, 0.02, 0]);
    },
  };
  return S;
}
