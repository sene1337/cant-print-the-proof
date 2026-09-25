// The headline (116.96-121.82): the genesis-block front page spins in out of the dark like an old movie insert,
// stops square to camera, and then a warm orange light rises behind it and shines through the paper.
import * as THREE from 'three';
import { newspaper, normalFromHeight } from '../tex.js';
import { clamp, hash1, lerp, rng, smooth, easeOut, easeInOut } from '../util.js';

export const NEWS = { W: 7, H: 5 };
const ORANGE = [0.969, 0.576, 0.102]; // #F7931A
// Emitted light is pushed deeper so that, after tone mapping through cream paper, it lands on Bitcoin orange.
const GLOW = [1.0, 0.33, 0.02];

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Newsprint fibre and a centre fold, as a gentle normal map.
function paperNormal() {
  const W = 1024, H = 732, c = canvas(W, H), g = c.getContext('2d');
  const R = rng(3);
  g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 16000; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * 0.12})` : `rgba(255,255,255,${R() * 0.12})`;
    g.fillRect(R() * W, R() * H, 1 + R() * 3, 1);
  }
  const fold = g.createLinearGradient(0, H * 0.47, 0, H * 0.53);
  fold.addColorStop(0, 'rgba(255,255,255,0)'); fold.addColorStop(0.5, 'rgba(0,0,0,0.5)'); fold.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fold; g.fillRect(0, H * 0.47, W, H * 0.06);
  return normalFromHeight(c, 1.2, 1);
}

function glowSprite() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export async function newsStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const key = new THREE.SpotLight(0xfff0d8, 70, 40, 0.5, 0.65, 1.2);
  key.position.set(-3, 6, 9);
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.25);
  fill.position.set(4, -1, 6);
  scene.add(fill);

  const tex = newspaper();
  const U = { uGlowR: { value: 0.35 }, uGlowC: { value: new THREE.Vector2(0.5, 0.69) } };
  const mat = new THREE.MeshStandardMaterial({
    map: tex, normalMap: paperNormal(), normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.88, metalness: 0,
    emissive: new THREE.Color(...GLOW), emissiveMap: tex, emissiveIntensity: 0,
  });
  // Backlight: the glow shines through the paper from a spot behind its centre; ink stays dark.
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uGlowR; uniform vec2 uGlowC;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec2 d = (vEmissiveMapUv - uGlowC) * vec2(1.4, 1.0);
          float r = length(d);
          float fall = exp(-(r * r) / (uGlowR * uGlowR));
          // paper passes light, ink blocks it: use the page's brightness as the paper mask, sharpened
          vec3 pm = texture2D(emissiveMap, vEmissiveMapUv).rgb;
          float paper = smoothstep(0.35, 0.85, dot(pm, vec3(0.333)));
          totalEmissiveRadiance = emissive * paper * fall * (0.25 + 0.75 * fall);
        }`);
  };
  mat.customProgramCacheKey = () => 'bridge-news-backlit';
  const geo = new THREE.PlaneGeometry(NEWS.W, NEWS.H, 70, 50);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    // a soft curl at the edges and a slight ridge at the fold
    p.setZ(i, 0.05 * Math.sin((x / NEWS.W) * Math.PI * 1.3 + 0.4) - 0.06 * Math.pow(Math.abs(y) / (NEWS.H / 2), 3) + 0.02 * Math.exp(-(y * y) * 40));
  }
  geo.computeVertexNormals();
  const paper = new THREE.Mesh(geo, mat);
  const holder = new THREE.Group();
  holder.add(paper);
  scene.add(holder);

  // Halo behind the page: the light spilling past its edges.
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: glowSprite(), color: new THREE.Color(...ORANGE), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.position.z = -0.6;
  holder.add(halo);

  const S = {
    scene, key, fill, paper, holder, halo, mat, U,
    fx: { bloom: 0.5, threshold: 1.0, bloomRadius: 0.5, grain: 0.06, vignette: 0.6, tint: [1.02, 1.0, 0.96], sat: 0.95, contrast: 1.08 },
    // Old-movie insert: spins out of the dark and slams square at tStop.
    spinIn(t, t0, tStop, turns = 1.5, zFrom = -46) {
      const u = clamp((t - t0) / (tStop - t0));
      const e = easeOut(u, 2.2);
      const after = Math.max(0, t - tStop);
      const settle = after > 0 ? Math.exp(-after * 9) * Math.sin(after * 30) * 0.035 : 0;
      holder.rotation.set(0, 0, (1 - e) * turns * Math.PI * 2 + settle);
      holder.position.set(0, 0, lerp(zFrom, 0, e));
    },
    // Backlight: glow gain k (0..), radius in page units.
    backlight(k, r = 0.35) {
      mat.emissiveIntensity = k;
      U.uGlowR.value = r;
      halo.material.opacity = clamp(k / 1.6) * 0.8;
      const s = 5 + 9 * r + 2.5 * clamp(k / 1.6);
      halo.scale.set(s * 1.4, s, 1);
      halo.visible = k > 0.001;
    },
    update(ctx) {
      holder.position.set(0, 0, 0);
      holder.rotation.set(0, 0, 0);
      holder.visible = true;
      key.intensity = 70;
      fill.intensity = 0.25;
      this.backlight(0);
    },
  };
  return S;
}
