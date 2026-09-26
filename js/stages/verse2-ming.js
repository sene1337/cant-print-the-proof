// VERSE 2 China: the Ming note (1375, "Da Ming Tongxing Baochao", the museum photo) on a lacquer table.
// A bronze seal slams down and re-inks the note's own treasury seal; then the note burns from its edges to nothing.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { loadImage, TEX, normalFromHeight } from '../tex.js';
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
// The note's own lower seal (the Ming treasury seal, stamped in folded seal script), measured in crop pixels.
// The stamp re-inks this real seal: nothing on the impression is invented.
const SEAL_PX = { x0: 199, y0: 526, x1: 397, y1: 747 };
const SEAL_UV = [(SEAL_PX.x0 + SEAL_PX.x1) / 2 / CROP.w, 1 - (SEAL_PX.y0 + SEAL_PX.y1) / 2 / CROP.h];
export const SEAL_POS = [(SEAL_UV[0] - 0.5) * NOTE_W, 0, -(SEAL_UV[1] - 0.5) * NOTE_H];
// The impression's size on the table (x, z), and the bronze seal's face, a little larger.
const IMP_W = ((SEAL_PX.x1 - SEAL_PX.x0) / CROP.w) * NOTE_W, IMP_D = ((SEAL_PX.y1 - SEAL_PX.y0) / CROP.h) * NOTE_H;
export const FACE_W = IMP_W + 0.035, FACE_D = IMP_D + 0.035;

// From the cropped photo: a copy with the seal's red ink lifted off (black ink kept), a copy with the same
// seal freshly re-inked, and the seal alone (mirrored, red on clear) for the paste on the bronze face.
function sealLayers(src) {
  const W = src.width, H = src.height;
  const g = src.getContext('2d');
  const d = g.getImageData(0, 0, W, H).data;
  const red = (i) => d[i] - (d[i + 1] + d[i + 2]) / 2;
  // local paper colour: blur only the plain paper pixels (not red ink, not black ink)
  const [pc, pg] = canvas2d(W, H);
  const pd = pg.createImageData(W, H);
  for (let i = 0; i < W * H * 4; i += 4) {
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const ok = red(i) < 16 && lum > 105;
    pd.data[i] = d[i]; pd.data[i + 1] = d[i + 1]; pd.data[i + 2] = d[i + 2]; pd.data[i + 3] = ok ? 255 : 0;
  }
  pg.putImageData(pd, 0, 0);
  const [bc, bg] = canvas2d(W, H);
  bg.filter = 'blur(9px)';
  bg.drawImage(pc, 0, 0);
  const paper = bg.getImageData(0, 0, W, H).data;
  const pad = 16, feather = 12;
  const win = (x, y) => {
    const dx = Math.max(SEAL_PX.x0 - pad - x, 0, x - SEAL_PX.x1 - pad);
    const dy = Math.max(SEAL_PX.y0 - pad - y, 0, y - SEAL_PX.y1 - pad);
    return clamp(1 - Math.hypot(dx, dy) / feather);
  };
  const [plainC, plainG] = canvas2d(W, H);
  const [sealC, sealG] = canvas2d(W, H);
  const [maskC, maskG] = canvas2d(W, H);
  const po = plainG.createImageData(W, H), so = sealG.createImageData(W, H), mo = maskG.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const w = win(x, y);
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      let ink = 0;
      if (w > 0) {
        const pa = paper[i + 3] > 8 ? 1 : 0;
        const pr = pa ? paper[i] : 186, pgc = pa ? paper[i + 1] : 170, pb = pa ? paper[i + 2] : 142;
        // red ink barely touches the red channel, black ink darkens it: R / paperR is the black-ink transmission
        const t = clamp(d[i] / Math.max(1, pr), 0, 1.08);
        const sR = clamp((red(i) - 6) / 14) * w;
        r = lerp(d[i], pr * t, sR); gg = lerp(d[i + 1], pgc * t, sR); b = lerp(d[i + 2], pb * t, sR);
        ink = clamp((red(i) - 10) / 18) * clamp(1 - Math.max(SEAL_PX.x0 - x, 0, x - SEAL_PX.x1, SEAL_PX.y0 - y, 0, y - SEAL_PX.y1) / 3);
      }
      po.data[i] = r; po.data[i + 1] = gg; po.data[i + 2] = b; po.data[i + 3] = 255;
      // fresh cinnabar works like a red filter over the paper
      const k = ink * 0.97;
      so.data[i] = r * lerp(1, 1.06, k); so.data[i + 1] = gg * lerp(1, 0.2, k); so.data[i + 2] = b * lerp(1, 0.16, k); so.data[i + 3] = 255;
      mo.data[i] = 205; mo.data[i + 1] = 30; mo.data[i + 2] = 22; mo.data[i + 3] = ink * 255;
    }
  }
  plainG.putImageData(po, 0, 0);
  sealG.putImageData(so, 0, 0);
  maskG.putImageData(mo, 0, 0);
  // the paste on the seal's face: the impression, mirrored, cropped to the seal
  const [fc, fg] = canvas2d(256, 256);
  fg.fillStyle = '#5a1510'; fg.fillRect(0, 0, 256, 256);
  fg.save(); fg.translate(256, 0); fg.scale(-1, 1);
  const mw = SEAL_PX.x1 - SEAL_PX.x0, mh = SEAL_PX.y1 - SEAL_PX.y0;
  const sx = 256 / (mw + 2 * 8), sy = 256 / (mh + 2 * 8);
  fg.drawImage(maskC, SEAL_PX.x0 - 8, SEAL_PX.y0 - 8, mw + 16, mh + 16, 0, 0, 256, 256);
  fg.restore();
  return { plain: plainC, sealed: sealC, face: fc };
}

// Cast bronze with green patina: colour and a roughness (G) / metalness (B) map from one noise field.
function bronzeMaps() {
  const F = noiseField(256, 61, 5);
  const [cc, cg] = canvas2d(256, 256);
  const [rc, rg] = canvas2d(256, 256);
  const ci = cg.createImageData(256, 256), ri = rg.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const n = F.data[i];
    const pat = clamp((n - 0.66) / 0.2) * 0.8;     // a little patina in the low spots of the noise
    const speck = hash1(i * 7 + 3) < 0.03 ? 0.25 : 0;
    const bz = [0.5, 0.34, 0.18], gr = [0.24, 0.31, 0.25];
    for (let k = 0; k < 3; k++) ci.data[i * 4 + k] = Math.round(255 * clamp(lerp(bz[k], gr[k], pat) * (0.85 + 0.3 * n) - speck * 0.2));
    ci.data[i * 4 + 3] = 255;
    ri.data[i * 4] = 0;
    ri.data[i * 4 + 1] = Math.round(255 * lerp(0.42, 0.8, pat));
    ri.data[i * 4 + 2] = Math.round(255 * lerp(0.9, 0.15, pat));
    ri.data[i * 4 + 3] = 255;
  }
  cg.putImageData(ci, 0, 0);
  rg.putImageData(ri, 0, 0);
  const col = canvasTex(cc, { repeat: true });
  const orm = canvasTex(rc, { srgb: false, repeat: true });
  return { col, orm };
}

// Tortoise-shell scutes as a height canvas on the hemisphere's uv (v = 1 at the top).
function shellHeight() {
  const W = 512, H = 256;
  const [c, g] = canvas2d(W, H);
  g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, W, H);
  // plates: a crown at the top, two rings of plates below, each softly domed, with grooves between
  const rings = [[0, 0.3, 1], [0.3, 0.62, 5], [0.62, 1.0, 11]];
  for (const [v0, v1, n] of rings) {
    for (let k = 0; k < n; k++) {
      const u0 = (k + (n > 1 ? 0.5 * (v0 > 0.5) : 0)) / n;
      const cx = (u0 + 0.5 / n) * W, cy = ((v0 + v1) / 2) * H;
      const rx = (0.5 / n) * W, ry = ((v1 - v0) / 2) * H;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      gr.addColorStop(0, '#f0f0f0'); gr.addColorStop(0.75, '#bdbdbd'); gr.addColorStop(1, '#8a8a8a');
      g.fillStyle = gr;
      g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      g.fillRect(cx - rx + W, cy - ry, rx * 2, ry * 2);
      g.fillRect(cx - rx - W, cy - ry, rx * 2, ry * 2);
    }
    g.fillStyle = '#3a3a3a';
    g.fillRect(0, v1 * H - 3, W, 6);
    for (let k = 0; k < n && n > 1; k++) {
      const x = ((k + 0.5 * (v0 > 0.5)) / n) * W;
      g.fillRect(x - 3, v0 * H, 6, (v1 - v0) * H);
    }
  }
  return c;
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
  const layers = sealLayers(c0);
  const plainTex = canvasTex(layers.plain);
  const sealedTex = canvasTex(layers.sealed);

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

  // The seal: a square block of cast bronze with a carved tortoise knob, the classic official seal.
  const seal = new THREE.Group();
  const bz = bronzeMaps();
  const bronze = clampHot(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: bz.col, metalness: 1, roughness: 1, metalnessMap: bz.orm, roughnessMap: bz.orm,
    envMapIntensity: 1.0,
  }), 2.2);
  const shellMat = bronze.clone();
  shellMat.normalMap = normalFromHeight(shellHeight(), 3.0, 1.5);
  shellMat.normalScale.set(1.6, 1.6);
  clampHot(shellMat, 2.2);
  const BASE_H = 0.3;
  const base = new THREE.Mesh(new RoundedBoxGeometry(FACE_W, BASE_H, FACE_D, 4, 0.02), bronze);
  base.position.y = BASE_H / 2;
  base.castShadow = true;
  seal.add(base);
  const step = new THREE.Mesh(new RoundedBoxGeometry(FACE_W * 0.86, 0.05, FACE_D * 0.86, 3, 0.015), bronze);
  step.position.y = BASE_H + 0.025;
  step.castShadow = true;
  seal.add(step);
  const top = BASE_H + 0.05;
  const turtle = new THREE.Group();
  turtle.position.y = top;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  shell.scale.set(FACE_W * 0.34, 0.13, FACE_D * 0.38);
  shell.position.y = 0.035;
  shell.castShadow = true;
  turtle.add(shell);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 10, 48), bronze);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(FACE_W * 0.35, FACE_D * 0.39, 0.5);
  rim.position.y = 0.035;
  turtle.add(rim);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bronze);
  head.scale.set(0.038, 0.034, 0.07);
  head.position.set(0, 0.075, FACE_D * 0.38 + 0.07);
  head.rotation.x = -0.25;
  head.castShadow = true;
  turtle.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.09, 16), bronze);
  neck.rotation.x = Math.PI / 2 - 0.35;
  neck.position.set(0, 0.05, FACE_D * 0.38 + 0.01);
  turtle.add(neck);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), bronze);
    leg.scale.set(0.05, 0.03, 0.04);
    leg.position.set(sx * FACE_W * 0.3, 0.025, sz * FACE_D * 0.27);
    leg.rotation.y = Math.atan2(sx, sz);
    turtle.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 10), bronze);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0.03, -FACE_D * 0.4 - 0.02);
  turtle.add(tail);
  seal.add(turtle);
  const paste = new THREE.Mesh(new THREE.PlaneGeometry(FACE_W - 0.01, FACE_D - 0.01), new THREE.MeshStandardMaterial({ map: canvasTex(layers.face), roughness: 0.5 }));
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
