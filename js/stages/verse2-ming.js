// VERSE 2 China: the Ming note (1375, "Da Ming Tongxing Baochao", the museum photo) on a lacquer table.
// A jade seal slams down and leaves a red seal; then the note burns from its edges to nothing.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { loadImage, TEX } from '../tex.js';
import { Dust } from '../props/dust.js';
import { clamp, lerp, hash1, rng, noise1, easeIn, easeOut } from '../util.js';
import {
  noiseField, burnUniforms, patchBurn, burnFieldJS, BURN_FIELD_GLSL, patch, clampHot,
  Flakes, flakeMaterial, SoftPoints, pointScale, canvas2d, canvasTex, sampleField,
} from '../props/verse2-kit.js';

// The photo has a white museum margin; crop to the paper.
const CROP = { x: 20, y: 30, w: 598, h: 925 };
export const NOTE_H = 2.0;
export const NOTE_W = NOTE_H * (CROP.w / CROP.h);
// Where the new seal lands on the note (uv), and its size in uv width.
const SEAL_UV = [0.5, 0.29], SEAL_W = 0.36;
export const SEAL_POS = [(SEAL_UV[0] - 0.5) * NOTE_W, 0, -(SEAL_UV[1] - 0.5) * NOTE_H];
export const SEAL_SIZE = SEAL_W * NOTE_W;

// A seal-script-like glyph built from character parts (boxes, bars, crosses), white on red (a "baiwen" seal).
function part(g, kind, x, y, w, h) {
  const box = () => g.strokeRect(x, y, w, h);
  const hl = (f) => { g.moveTo(x, y + h * f); g.lineTo(x + w, y + h * f); };
  const vl = (f) => { g.moveTo(x + w * f, y); g.lineTo(x + w * f, y + h); };
  g.beginPath();
  if (kind === 0) box();                                   // kou: a box
  else if (kind === 1) { box(); hl(0.5); }                  // ri: box with a bar
  else if (kind === 2) { box(); hl(0.34); hl(0.67); }       // mu: box with two bars
  else if (kind === 3) { box(); hl(0.5); vl(0.5); }         // tian: a field
  else if (kind === 4) { hl(0); hl(0.5); hl(1); vl(0.5); }  // wang
  else if (kind === 5) { hl(0.08); hl(0.5); hl(0.92); }     // san: three bars
  else if (kind === 6) { vl(0.12); vl(0.5); vl(0.88); hl(0); } // a comb
  else { hl(0.3); vl(0.5); hl(1); }                         // tu
  g.stroke();
}

function glyph(g, x, y, s, seed) {
  const R = rng(seed);
  g.lineWidth = s * 0.085; g.lineCap = 'square'; g.lineJoin = 'miter';
  const k = () => Math.floor(R() * 8);
  const layout = Math.floor(R() * 3);
  if (layout === 0) {        // left and right
    part(g, k(), x, y, s * 0.36, s);
    part(g, k(), x + s * 0.48, y, s * 0.52, s);
  } else if (layout === 1) { // top and bottom
    part(g, k(), x, y, s, s * 0.38);
    part(g, k(), x, y + s * 0.52, s, s * 0.48);
  } else {                   // enclosure
    g.beginPath(); g.moveTo(x, y + s); g.lineTo(x, y); g.lineTo(x + s, y); g.lineTo(x + s, y + s); g.stroke();
    part(g, k(), x + s * 0.22, y + s * 0.24, s * 0.56, s * 0.58);
  }
}

function drawSeal(g, cx, cy, size, { mirror = false, ink = 1 } = {}) {
  g.save();
  g.translate(cx, cy);
  if (mirror) g.scale(-1, 1);
  const h = size / 2;
  // red field, slightly uneven like stamped cinnabar paste
  g.fillStyle = `rgba(196, 22, 16, ${0.93 * ink})`;
  g.beginPath(); g.roundRect(-h, -h, size, size, size * 0.04); g.fill();
  // carved white: inner border and four glyphs
  g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = 'rgba(0,0,0,1)';
  g.lineWidth = size * 0.035;
  g.strokeRect(-h * 0.86, -h * 0.86, h * 1.72, h * 1.72);
  const cs = h * 0.62;
  let k = 0;
  for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    glyph(g, ox * h * 0.4 - cs / 2, oy * h * 0.4 - cs / 2, cs, 71 + k * 13);
    k++;
  }
  // speckle where the paste did not take
  const R = rng(5);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${R() * 0.5})`;
    const r = R() * size * 0.012 + 0.5;
    g.beginPath(); g.arc((R() - 0.5) * size, (R() - 0.5) * size, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export async function mingStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030101);
  scene.environment = studioEnv(film.renderer, [
    { pos: [-2, 6, 2], size: [4, 2], color: [1, 0.93, 0.85], intensity: 2.0 },
    { pos: [5, 1.5, -3], size: [0.6, 4], color: [1, 0.55, 0.35], intensity: 1.5 },
  ], { top: [0.12, 0.1, 0.09], horizon: [0.03, 0.015, 0.012], bottom: [0.0, 0.0, 0.0] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xfff0dc, 40, 20, 0.55, 0.7, 2);
  key.position.set(-1.6, 4.2, 1.8);
  key.target.position.set(0, 0, 0.1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x6e7f9a, 0.25);
  fill.position.set(3, 2, 3);
  scene.add(fill);
  // Firelight for the burn.
  const fire = new THREE.PointLight(0xff7a2e, 0, 8, 2);
  fire.position.set(0, 0.5, 0);
  scene.add(fire);

  // Black-red lacquer table.
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshPhysicalMaterial({ color: 0x1c0605, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.16, envMapIntensity: 0.6 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  // The note, plain and sealed.
  const im = await loadImage(`${TEX.base}tex/mingnote.jpg`);
  const [c0, g0] = canvas2d(CROP.w, CROP.h);
  g0.drawImage(im, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, CROP.w, CROP.h);
  const plainTex = canvasTex(c0);
  const [c1, g1] = canvas2d(CROP.w, CROP.h);
  g1.drawImage(c0, 0, 0);
  drawSeal(g1, SEAL_UV[0] * CROP.w, (1 - SEAL_UV[1]) * CROP.h, SEAL_W * CROP.w);
  const sealedTex = canvasTex(c1);

  const field = noiseField(256, 33);
  const U = burnUniforms(field, { mode: 0, aspect: NOTE_W / NOTE_H, noiseAmp: 0.34, noiseScale: 1.6, charW: 0.1, emberW: 0.018, emberGain: 3.2, emberCol: [1, 0.36, 0.05] });
  U.uCurl = { value: 0.0 };
  const noteMat = new THREE.MeshStandardMaterial({ map: plainTex, roughness: 0.92, side: THREE.DoubleSide });
  patchBurn(noteMat, U);
  // The burning edge lifts and curls.
  patch(noteMat, 'curl', (sh) => {
    sh.uniforms.uCurl = U.uCurl;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uBurn, uMode, uAspect, uNoiseAmp, uNoiseScale, uCurl; uniform sampler2D uField;
        ${BURN_FIELD_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float ce = burnField(uv) - uBurn; transformed.z += uCurl * (1.0 - smoothstep(0.0, 0.2, ce)) * step(-0.01, ce) * (0.6 + 0.4 * sin(uv.x * 40.0 + uv.y * 23.0)); }`);
  });
  const noteGeo = new THREE.PlaneGeometry(NOTE_W, NOTE_H, 48, 72);
  // a little paper sag and a lifted corner
  {
    const p = noteGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / NOTE_W, y = p.getY(i) / NOTE_H;
      // never below the table: the sheet only rises off it
      p.setZ(i, 0.007 * (1 + Math.sin(x * 5.1 + 0.4) * Math.cos(y * 3.3)) + 0.05 * Math.max(0, x + y - 0.62) ** 2);
    }
    noteGeo.computeVertexNormals();
  }
  const note = new THREE.Mesh(noteGeo, noteMat);
  note.rotation.x = -Math.PI / 2;
  note.position.y = 0.004;
  note.receiveShadow = true;
  scene.add(note);

  // The seal: one heavy block of veined dark-green jade, a chamfered column under a pyramid cap, red paste on its face.
  const seal = new THREE.Group();
  const jadeTex = (() => {
    const F = noiseField(256, 47, 5);
    const W = 256, H = 512;
    const [c, g] = canvas2d(W, H);
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = sampleField(F, x / W, y / H);
        const vein = Math.pow(Math.abs(Math.sin((x * 0.008 + y * 0.005 + n * 2.2) * Math.PI)), 60);
        const vein2 = Math.pow(Math.abs(Math.sin((x * 0.003 - y * 0.009 + n * 1.6) * Math.PI)), 90);
        const m = n * n;
        const base = [0.06 + 0.1 * m, 0.19 + 0.2 * m, 0.12 + 0.12 * m];
        const v = Math.min(1, vein * 0.4 + vein2 * 0.3);
        const vc = [0.6, 0.8, 0.66];
        const i = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) img.data[i + k] = Math.round(255 * (base[k] + (vc[k] - base[k]) * v));
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return canvasTex(c);
  })();
  const jade = clampHot(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: jadeTex, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08,
    sheen: 0.5, sheenColor: new THREE.Color(0.55, 0.85, 0.65), sheenRoughness: 0.45,
  }), 3);
  const column = new THREE.Mesh(new RoundedBoxGeometry(SEAL_SIZE * 1.04, 0.78, SEAL_SIZE * 1.04, 5, 0.035), jade);
  column.position.y = 0.39;
  column.castShadow = true;
  seal.add(column);
  const cr = SEAL_SIZE * 0.52 * Math.SQRT2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(cr * 0.32, cr, 0.2, 4, 1), jade);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 0.88;
  cap.castShadow = true;
  seal.add(cap);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(SEAL_SIZE * 0.13, 24, 16), jade);
  knob.scale.set(1, 0.8, 1);
  knob.position.y = 1.0;
  seal.add(knob);
  const [cs, gs] = canvas2d(256, 256);
  drawSeal(gs, 128, 128, 250, { mirror: true });
  const paste = new THREE.Mesh(new THREE.PlaneGeometry(SEAL_SIZE, SEAL_SIZE), new THREE.MeshStandardMaterial({ map: canvasTex(cs), transparent: true, roughness: 0.6 }));
  paste.rotation.x = Math.PI / 2;
  paste.position.y = -0.001;
  seal.add(paste);
  scene.add(seal);

  // Ash flakes carry pieces of the note; sparks rise from the ember line.
  const NASH = 420;
  // an irregular, slightly cupped flake instead of a square
  const flakeGeo = (() => {
    const sh = new THREE.Shape();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 0.34 + 0.18 * hash1(i * 31 + 7);
      i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ShapeGeometry(sh);
    const pa = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i);
      pa.setZ(i, (x * x + y * y) * 0.35);
      uv.setXY(i, x + 0.5, y + 0.5);
    }
    g.computeVertexNormals();
    return g;
  })();
  const ashMat = flakeMaterial(sealedTex, { emberCol: [1, 0.36, 0.06] });
  ashMat.color.setScalar(0.35);
  const ash = new Flakes(flakeGeo, ashMat, NASH);
  scene.add(ash);
  const NSP = 260;
  const sparks = new SoftPoints(NSP, { color: [1, 0.55, 0.16], additive: true });
  scene.add(sparks);
  const ashSeeds = [];
  for (let i = 0; i < NASH; i++) {
    const u = hash1(i * 3 + 1), v = hash1(i * 3 + 2);
    ashSeeds.push({ u, v, f: burnFieldJS(field, U, u, v) });
  }
  const sparkSeeds = [];
  for (let i = 0; i < NSP; i++) {
    const u = hash1(i * 7 + 11), v = hash1(i * 7 + 12);
    sparkSeeds.push({ u, v, f: burnFieldJS(field, U, u, v) });
  }

  const dust = new Dust({ count: 400, size: 0.008, box: [6, 3, 6], color: [1, 0.85, 0.7], gain: 0.5 });
  scene.add(dust);

  const notePoint = (u, v) => new THREE.Vector3((u - 0.5) * NOTE_W, 0.01, -(v - 0.5) * NOTE_H);

  const S = {
    scene, note, noteMat, seal, table, key, fill, fire, ash, sparks, dust, U, plainTex, sealedTex,
    fx: { bloom: 0.55, threshold: 0.95, bloomRadius: 0.45, grain: 0.045, vignette: 0.55, tint: [1.02, 0.98, 0.95] },

    // Seal motion around the impact time tHit. Returns the impact pulse (for shake).
    sealAt(t, tHit) {
      const dt = t - tHit;
      let y;
      if (dt < -0.22) y = 2.6;
      else if (dt < 0) y = lerp(2.6, 0, easeIn(1 + dt / 0.22, 2.6));
      else if (dt < 0.16) y = -0.012 * Math.sin((dt / 0.16) * Math.PI);
      else y = lerp(0, 3.0, easeIn(clamp((dt - 0.16) / 0.5), 1.8));
      seal.visible = y < 2.55;
      seal.position.set(SEAL_POS[0], y + 0.004, SEAL_POS[2]);
      seal.rotation.set(0, 0.08, dt > 0.16 ? -0.12 * clamp((dt - 0.16) / 0.5) : 0);
      noteMat.map = dt >= 0 ? sealedTex : plainTex;
      return dt >= 0 ? Math.exp(-dt * 10) : 0;
    },

    // Burn: b is the burn front (-1 intact, ~1.3 gone). bOf(t) maps song time to the front (monotone).
    burnAt(t, bOf, t0, t1) {
      const b = bOf(t);
      U.uBurn.value = b;
      U.uTime.value = t;
      U.uCurl.value = 0.1;
      noteMat.map = sealedTex;
      note.visible = b < 1.35;
      // invert bOf by bisection: when did the front reach value f?
      const when = (f) => {
        if (bOf(t0) >= f) return t0;
        let lo = t0, hi = t1;
        for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (bOf(m) >= f) hi = m; else lo = m; }
        return hi;
      };
      // firelight follows how much ember line is left
      const burning = clamp((b + 0.05) / 0.15) * (1 - clamp((b - 0.45) / 0.5));
      fire.intensity = burning * (3.5 + 2 * noise1(t * 9, 4));
      // a warm pool on the table: the lacquer goes matte while burning so the light has no mirror hotspot
      fire.position.set(0.1 * Math.sin(t * 3), 1.0, 0.1 * Math.cos(t * 2.3));
      table.material.clearcoat = 0;
      ash.visible = true;
      ash.layoutFlakes(NASH, (i, d, rect, glow) => {
        const s = ashSeeds[i];
        if (s.f > b || s.f < -0.2) return false;
        const a = t - when(s.f);
        if (a < 0 || a > 2.6) return false;
        const h = (q) => hash1(i * 17 + q);
        const p = notePoint(s.u, s.v);
        const rise = a * (0.12 + h(1) * 0.25) + a * a * (0.06 + h(2) * 0.08);
        d.position.set(p.x + Math.sin(a * 1.7 + h(3) * 6) * 0.12 * a + a * 0.05, p.y + rise, p.z + Math.cos(a * 1.3 + h(4) * 6) * 0.1 * a - a * 0.04);
        d.rotation.set(a * (2 + h(5) * 4) + h(6) * 6, a * (1 + h(7) * 3), a * (1.5 + h(8) * 2));
        const sz = (0.02 + h(9) * 0.04) * (1 - clamp((a - 1.8) / 0.8));
        d.scale.set(sz, sz * (0.6 + h(10) * 0.5), 1);
        rect[0] = s.u - 0.015; rect[1] = s.v - 0.015; rect[2] = 0.03; rect[3] = 0.03;
        glow[0] = 1.6 * Math.exp(-a * 6) * (0.4 + h(11));
        glow[1] = 0.93;
      });
      sparks.visible = true;
      sparks.layout(NSP, (i, o) => {
        const s = sparkSeeds[i];
        if (s.f > b || s.f < -0.2) return false;
        const a = t - when(s.f) - hash1(i * 5) * 0.2;
        if (a < 0 || a > 0.9) return false;
        const p = notePoint(s.u, s.v);
        o.x = p.x + Math.sin(i + a * 4) * 0.05 * a;
        o.y = p.y + a * (0.6 + hash1(i * 5 + 1) * 0.9);
        o.z = p.z + Math.cos(i * 1.3 + a * 3) * 0.05 * a;
        o.size = 0.02 + hash1(i * 5 + 2) * 0.02;
        o.alpha = (1 - a / 0.9) * 1.6;
      }, pointScale(film, film.camera));
    },

    update(ctx) {
      note.visible = true;
      noteMat.map = plainTex;
      U.uBurn.value = -1;
      U.uCurl.value = 0;
      U.uTime.value = ctx.t;
      seal.visible = false;
      ash.visible = false;
      sparks.visible = false;
      fire.intensity = 0;
      table.material.clearcoat = 1;
      key.intensity = 40;
      key.position.set(-1.6, 4.2, 1.8);
      scene.environmentIntensity = 1.0;
      dust.visible = true;
      dust.setTime(ctx.t, [0.02, 0.03, 0]);
    },
  };
  return S;
}
