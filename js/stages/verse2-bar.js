// VERSE 2 1912: one heavy gold bar under one hard light. It hangs in the beam, slams down on "Gold",
// and a weightless paper IOU drifts onto it and slides off into the dark on "credit".
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { Dust } from '../props/dust.js';
import { normalFromHeight } from '../tex.js';
import { clamp, lerp, hash1, rng, noise1, easeIn, easeOut, easeInOut } from '../util.js';
import { clampHot, SoftPoints, pointScale, canvas2d, canvasTex, noiseField } from '../props/verse2-kit.js';

export const BAR = { L: 2.4, W: 0.9, H: 0.42, topL: 2.14, topW: 0.64 };

export function barGeometry() {
  const g = new RoundedBoxGeometry(BAR.L, BAR.H, BAR.W, 4, 0.035);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) + BAR.H / 2) / BAR.H;
    p.setX(i, p.getX(i) * lerp(1, BAR.topL / BAR.L, k));
    p.setZ(i, p.getZ(i) * lerp(1, BAR.topW / BAR.W, k));
  }
  g.translate(0, BAR.H / 2, 0);
  g.computeVertexNormals();
  return g;
}

// The assay stamp on the bar's top face: colour (dark recessed letters) and height (letters low).
export function stamp() {
  const w = 1024, h = 310;
  const draw = (g, bg, ink) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = ink; g.fillStyle = ink;
    g.lineWidth = 7;
    g.beginPath(); g.roundRect(70, 48, w - 140, h - 96, 60); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.roundRect(86, 64, w - 172, h - 128, 48); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 150px "Playfair Display"';
    g.fillText('1912', w / 2, h / 2 + 6);
    g.font = '700 46px "Cormorant Garamond"';
    g.fillText('FINE', 205, h / 2 - 24); g.fillText('GOLD', 205, h / 2 + 26);
    g.font = '700 58px "Cormorant Garamond"';
    g.fillText('999.9', w - 210, h / 2 + 4);
  };
  const [cc, cg] = canvas2d(w, h);
  draw(cg, '#ffffff', '#6b4a22');
  const [hc, hg] = canvas2d(w, h);
  draw(hg, '#ffffff', '#303030');
  return { color: canvasTex(cc), normal: normalFromHeight(hc, 2.2, 1.2) };
}

function woodTexture() {
  const w = 1024, h = 512;
  const [c, g] = canvas2d(w, h);
  const R = rng(19);
  g.fillStyle = '#2a120a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = R() * h, a = 0.05 + R() * 0.12, th = 1 + R() * 3;
    g.strokeStyle = R() < 0.5 ? `rgba(12,4,2,${a})` : `rgba(90,44,24,${a})`;
    g.lineWidth = th;
    g.beginPath();
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.006 + i) * 6 + Math.sin(x * 0.021 + i * 3) * 2);
    g.stroke();
  }
  return canvasTex(c, { repeat: true });
}

function iouTexture() {
  const w = 1024, h = 480;
  const [c, g] = canvas2d(w, h);
  const R = rng(12);
  g.fillStyle = '#efe7d2'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(120,100,70,${R() * 0.07})`; g.fillRect(R() * w, R() * h, R() * 3 + 1, 1); }
  g.strokeStyle = '#3a3224'; g.lineWidth = 4; g.strokeRect(22, 22, w - 44, h - 44);
  g.fillStyle = '#1f1a14'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 230px "Playfair Display"';
  g.fillText('I.O.U.', w / 2, h / 2 - 34);
  g.font = '600 44px "Cormorant Garamond"';
  g.fillText('PAYABLE  ON  DEMAND', w / 2, h - 92);
  // a signature in blue-black ink
  g.strokeStyle = '#1d2a4a'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    g.lineTo(640 + u * 300, h - 150 + Math.sin(u * 16) * 14 - u * 20);
  }
  g.stroke();
  return canvasTex(c);
}

// A soft, additive light cone for the beam.
function beam(height, radius) {
  const geo = new THREE.ConeGeometry(radius, height, 64, 1, true);
  geo.translate(0, -height / 2, 0); // apex at the origin, opening downward
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1, 0.9, 0.72) }, uGain: { value: 0.1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uGain; varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.5);
        float a = f * mix(0.35, 1.0, vY) * uGain;
        gl_FragColor = vec4(uColor * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

export async function barStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020101);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 0], size: [2.5, 2.5], color: [1, 0.92, 0.78], intensity: 3.0 },
    { pos: [-6, 1.5, 2], size: [0.5, 3], color: [1, 0.8, 0.55], intensity: 1.6 },
    { pos: [6, 1, -2], size: [0.5, 3], color: [1, 0.85, 0.65], intensity: 1.2 },
  ], { top: [0.06, 0.05, 0.04], horizon: [0.02, 0.015, 0.01], bottom: [0, 0, 0] });
  scene.environmentIntensity = 1.0;

  const LIGHT = new THREE.Vector3(0.3, 6.2, 0.5);
  const spot = new THREE.SpotLight(0xfff0d8, 70, 20, 0.34, 0.35, 2);
  spot.position.copy(LIGHT);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0002;
  scene.add(spot, spot.target);
  const cone = beam(LIGHT.y + 0.2, (LIGHT.y + 0.2) * Math.tan(0.34) * 0.95);
  cone.position.copy(LIGHT);
  cone.lookAt(0, 0, 0);
  cone.rotateX(-Math.PI / 2); // the cone's -y (its opening) now points at the table
  scene.add(cone);

  // Heavy dark table.
  const wood = woodTexture();
  wood.repeat.set(1.5, 1);
  const table = new THREE.Mesh(new THREE.BoxGeometry(9, 0.25, 5), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.25 }));
  table.position.y = -0.125;
  table.receiveShadow = true;
  scene.add(table);

  // The bar.
  const st = stamp();
  const gold = clampHot(new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.22 }), 3.5);
  const goldTop = clampHot(new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.24, map: st.color, normalMap: st.normal, normalScale: new THREE.Vector2(1, 1) }), 6);
  const bar = new THREE.Mesh(barGeometry(), [gold, gold, goldTop, gold, gold, gold]);
  bar.castShadow = true; bar.receiveShadow = true;
  scene.add(bar);

  // The IOU slip.
  const iou = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.43, 10, 4), new THREE.MeshStandardMaterial({ map: iouTexture(), roughness: 0.85, side: THREE.DoubleSide }));
  iou.castShadow = true;
  scene.add(iou);

  // Dust thrown up by the slam, and motes in the beam.
  const NP = 420;
  const puff = new SoftPoints(NP, { color: [0.5, 0.42, 0.33], opacity: 0.35 });
  scene.add(puff);
  const motes = new Dust({ count: 700, size: 0.012, box: [3, 6, 3], color: [1, 0.9, 0.75], gain: 0.9 });
  motes.position.set(0.1, 3, 0.2);
  scene.add(motes);

  const S = {
    scene, bar, iou, spot, cone, table, puff, motes, BAR,
    fx: { bloom: 0.5, threshold: 1.0, bloomRadius: 0.4, grain: 0.045, vignette: 0.6, tint: [1.03, 0.99, 0.93] },

    lightOn(t, t0) {
      // full on from the first frame of the word, with a brief hot overshoot as the filament catches
      const dt = t - t0;
      const on = dt < 0 ? 0 : 1 + 0.45 * Math.exp(-dt * 14);
      spot.intensity = 70 * on;
      cone.material.uniforms.uGain.value = 0.1 * on;
      scene.environmentIntensity = 0.15 + 0.85 * on;
      return on;
    },

    // Floating and turning in the beam.
    floatAt(t, t0) {
      bar.position.set(0, 1.15 + 0.03 * Math.sin((t - t0) * 2.1), 0);
      bar.rotation.set(0.05 * Math.sin((t - t0) * 1.3), -0.5 + (t - t0) * 0.32, 0.04);
    },

    // The drop: contact at tHit. Returns the impact pulse.
    slamAt(t, tHit, fromY = 1.5, fall = 0.14) {
      const dt = t - tHit;
      let y = 0;
      if (dt < 0) y = fromY * (1 - easeIn(clamp(1 + dt / fall), 2));
      else y = Math.abs(Math.sin(dt * 30)) * 0.018 * Math.exp(-dt * 14);
      bar.position.set(0, y, 0);
      bar.rotation.set(0, -0.28, dt < 0 ? 0.03 : 0);
      // dust ring along the table
      puff.visible = dt > 0;
      if (dt > 0) {
        puff.layout(NP, (i, o) => {
          const h = (q) => hash1(i * 7 + q);
          const a = h(1) * Math.PI * 2;
          const sp = 0.6 + h(2) * 1.6;
          const r = 0.05 + sp * (1 - Math.exp(-dt * 5)) * 0.55;
          const ex = Math.abs(Math.cos(a)) * BAR.L * 0.5, ez = Math.abs(Math.sin(a)) * BAR.W * 0.5;
          o.x = Math.cos(a) * (ex + r);
          o.z = Math.sin(a) * (ez + r * 0.7);
          o.y = 0.02 + h(3) * 0.06 + dt * (0.06 + h(4) * 0.14);
          o.size = 0.05 + h(5) * 0.07 + dt * 0.12;
          o.alpha = clamp(1 - dt / (0.6 + h(6) * 0.7)) * 0.7;
        }, pointScale(film, film.camera));
      }
      return dt >= 0 ? Math.exp(-dt * 12) : 0;
    },

    // The IOU drifts down rocking, lands on the bar at tLand, and slides off after tSlide.
    iouAt(t, t0, tLand, tSlide) {
      bar.position.set(0, 0, 0);
      bar.rotation.set(0, -0.28, 0);
      iou.visible = true;
      const topY = BAR.H + 0.006;
      if (t < tLand) {
        const u = clamp((t - t0) / (tLand - t0));
        const y = lerp(1.9, topY, easeOut(u, 1.15));
        const sw = Math.sin(u * Math.PI * 2.2);
        iou.position.set(0.15 + sw * 0.28 * (1 - u), y, 0.05 + Math.cos(u * 5) * 0.08 * (1 - u));
        iou.rotation.set(-Math.PI / 2 + sw * 0.35 * (1 - u), 0, 0.3 + sw * 0.25 * (1 - u));
      } else {
        const s = Math.max(0, t - tSlide + 0.08);
        const slide = s * s * 5.5;
        const off = Math.max(0, slide - 0.1);
        iou.position.set(0.15 - slide * 0.5, topY - off * off * 3 - off * 0.8, 0.05 + slide);
        iou.rotation.set(-Math.PI / 2 + Math.min(1.1, off * 2.5), 0, 0.3 + slide * 0.4);
      }
    },

    update(ctx) {
      bar.visible = true;
      bar.position.set(0, 0, 0);
      bar.rotation.set(0, -0.28, 0);
      iou.visible = false;
      puff.visible = false;
      spot.intensity = 70;
      cone.material.uniforms.uGain.value = 0.1;
      scene.environmentIntensity = 1.0;
      motes.visible = true;
      motes.setTime(ctx.t, [0.01, -0.04, 0]);
    },
  };
  return S;
}
