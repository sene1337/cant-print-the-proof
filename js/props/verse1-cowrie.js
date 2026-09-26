// A money cowrie (Monetaria moneta): a smooth humped back over thick, calloused margins, a flat white base, and
// a clearly open mouth whose lips carry long comb-like teeth with dark grooves between them. Hard, wet porcelain.
// Built as a parametric surface: superellipse cross-sections (a cushion on top, a flat base below).
// Local frame: long axis X (length 1, x in -0.5..0.5; +X is the broad posterior end), back up (+Y),
// mouth on the base (-Y).
import * as THREE from 'three';
import { rng, hash1 } from '../util.js';
import { studioEnv } from '../film.js';
import { normalFromHeight } from '../tex.js';

const L = 0.5, W = 0.355, HT = 0.34, HB = 0.085;
const TEETH_N = 13;      // teeth per lip
const S0 = 0.8;          // the mouth runs over s in [-S0, S0]
const slitC = (s) => 0.025 * s + 0.02 * s * s * s; // the mouth bends slightly
// half-width of the mouth (radians around the long axis): wider toward the broad end
const slitW = (s) => 0.06 + 0.03 * (s + 1) / 2;
const LIPW = 0.3;        // how far the teeth run out across each lip (radians)

// Outline seen from above: ovate, broadest a little behind the middle.
export const rhoOf = (s) => Math.pow(Math.max(0, 1 - s * s), 0.4) * (1 + 0.07 * s) * (1 + 0.05 * Math.exp(-Math.pow((s - 0.25) / 0.35, 2)));
// Height of the back along the length: a smooth hump, highest just behind the middle.
const hgtOf = (s) => Math.pow(Math.max(0, 1 - s * s), 0.55) * (1 + 0.06 * s);

// Around-angle th: 0 = the mouth (base centre), PI = top of the back. Denser near the mouth.
function thetaOf(a) {
  return (a * Math.PI * 2) * 0.28 + Math.PI * (1 - Math.cos(Math.PI * a)) * 0.72;
}
function wrapAngle(a) { return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// Tooth profile along s for one lip (the two lips are offset half a tooth): 1 on a ridge, 0 in a groove.
// Ridges are narrower than grooves, so they read as sharp teeth.
export function tooth(s, side) {
  const spacing = (2 * S0) / TEETH_N;
  const q = (s + S0) / spacing + (side ? 0.5 : 0);
  const f = q - Math.floor(q);
  return Math.pow(Math.max(0, Math.sin(Math.PI * f)), 3) * (1 - smoothstep(S0 - 0.06, S0 + 0.03, Math.abs(s)));
}

export function cowrieGeometry({ NU = 260, NV = 260 } = {}) {
  const pos = [], uv = [], idx = [];
  const NT = 2.5; // superellipse exponent of the back: >2 gives square, calloused shoulders
  for (let i = 0; i <= NU; i++) {
    const s = -1 + (2 * i) / NU;
    const rho = rhoOf(s), hg = hgtOf(s);
    const sw = slitW(s);
    for (let j = 0; j <= NV; j++) {
      const th = thetaOf(j / NV);
      const c = -Math.cos(th); // +1 top, -1 bottom
      const sn = Math.sin(th);
      // thick margins: a rounded roll of shell just above the base, all the way round
      const callus = Math.exp(-Math.pow((c + 0.02) / 0.3, 2));
      let y, z;
      if (c >= 0) {
        z = W * rho * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / NT) * (1 + 0.075 * callus);
        y = HT * hg * Math.pow(c, 2 / NT) * (1 - 0.1 * callus * (1 - c));
      } else {
        z = W * rho * sn * (1 + 0.075 * callus);
        y = -HB * Math.pow(rho, 0.35) * Math.pow(-c, 0.55);
      }
      let x = L * s;
      // the mouth and its teeth, on the base
      const wa = wrapAngle(th - slitC(s));
      const d = Math.abs(wa);
      if (c < 0 && d < sw + LIPW) {
        const endFade = 1 - smoothstep(0.88, 1.0, Math.abs(s));
        const t = tooth(s, wa > 0 ? 0 : 1);
        if (d < sw) {
          // the open mouth: a deep channel; the teeth run down its walls
          const k = 1 - (d / sw) * (d / sw);
          y += 0.16 * hg * Math.sqrt(k) * endFade * (1 - 0.35 * t * (d / sw));
        } else {
          // the lips: a rolled edge, and long comb ridges that fade out across the base
          const e = (d - sw) / LIPW; // 0 at the mouth's edge, 1 where the teeth end
          const teeth = t * (1 - smoothstep(0.25, 1.0, e)) * smoothstep(0, 0.04, e);
          y -= (0.017 * teeth - 0.006 * (1 - t) * (1 - smoothstep(0.1, 0.9, e))) * endFade;
          y += 0.012 * (1 - smoothstep(0, 0.1, e)) * endFade; // the lip rolls over into the mouth
        }
      }
      // the short canals at both ends, where the mouth opens
      if (Math.abs(s) > 0.86 && c < -0.25) {
        const k = smoothstep(0.86, 1.0, Math.abs(s)) * smoothstep(-0.25, -0.9, c) * (1 - smoothstep(sw, sw * 3, d));
        x *= 1 - 0.05 * k;
      }
      pos.push(x, y, z);
      uv.push((s + 1) / 2, th / (Math.PI * 2));
    }
  }
  const row = NV + 1;
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * row + j, b = a + row, c = b + 1, d = a + 1;
      idx.push(a, b, d, b, c, d); // counter-clockwise seen from outside
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Colour map in (u = along the length, v = around) space. CanvasTexture flips Y: texture v is canvas (1 - v).
// v: 0 and 1 = the mouth, 0.25 and 0.75 = the margins, 0.5 = the top of the back.
// No canvas filters (a blur filter over many draws once blacked this texture out).
export function cowrieTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const R = rng(31);
  const vy = (v) => (1 - v) * h;
  // white base, cream margins, butter-yellow back
  const grd = g.createLinearGradient(0, vy(0), 0, vy(1));
  const stops = [[0, '#f6f2ea'], [0.16, '#f5f0e5'], [0.22, '#f2e8d0'], [0.27, '#ead398'], [0.32, '#dfbb5c'],
    [0.5, '#d6aa42'], [0.68, '#dfbb5c'], [0.73, '#ead398'], [0.78, '#f2e8d0'], [0.84, '#f5f0e5'], [1, '#f6f2ea']];
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  // the ends a touch warmer
  for (const x0 of [0, w]) {
    const eg = g.createRadialGradient(x0, h / 2, 0, x0, h / 2, w * 0.1);
    eg.addColorStop(0, 'rgba(210,160,90,0.25)'); eg.addColorStop(1, 'rgba(210,160,90,0)');
    g.fillStyle = eg; g.fillRect(0, 0, w, h);
  }
  // three faint grey-green bands across the back
  for (const u0 of [0.33, 0.52, 0.7]) {
    const bw = w * 0.06;
    const bg = g.createLinearGradient(u0 * w - bw, 0, u0 * w + bw, 0);
    bg.addColorStop(0, 'rgba(110,118,90,0)'); bg.addColorStop(0.5, 'rgba(110,118,90,0.26)'); bg.addColorStop(1, 'rgba(110,118,90,0)');
    g.fillStyle = bg; g.fillRect(u0 * w - bw, vy(0.66), bw * 2, vy(0.34) - vy(0.66));
  }
  // soft mottling on the back
  for (let i = 0; i < 160; i++) {
    const u = 0.1 + R() * 0.8, v = 0.33 + R() * 0.34, r = 10 + R() * 40;
    const cg = g.createRadialGradient(u * w, vy(v), 0, u * w, vy(v), r);
    const tone = R();
    const col = tone < 0.35 ? '248,232,176' : tone < 0.7 ? '176,130,64' : '126,132,104';
    cg.addColorStop(0, `rgba(${col},0.24)`); cg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = cg; g.fillRect(u * w - r, vy(v) - r, r * 2, r * 2);
  }
  // tiny pale flecks on the back
  for (let i = 0; i < 220; i++) {
    const u = 0.12 + R() * 0.76, v = 0.35 + R() * 0.3, r = 1.5 + R() * 3;
    g.fillStyle = `rgba(250,240,206,${(0.12 + R() * 0.16).toFixed(3)})`;
    g.beginPath(); g.ellipse(u * w, vy(v), r * 1.6, r, 0, 0, Math.PI * 2); g.fill();
  }
  // faint growth lines across the back
  for (let i = 0; i < 60; i++) {
    const u = 0.08 + R() * 0.84;
    g.strokeStyle = `rgba(160,120,60,${(0.03 + R() * 0.04).toFixed(3)})`; g.lineWidth = 1 + R() * 2;
    g.beginPath(); g.moveTo(u * w, vy(0.3)); g.lineTo(u * w + (R() - 0.5) * 30, vy(0.7)); g.stroke();
  }
  // the faint orange ring round the back, just inside the margins: a soft glow, no hard edge
  for (let k = 0; k < 8; k++) {
    g.strokeStyle = `rgba(220,120,40,${(0.09 - k * 0.01).toFixed(3)})`;
    g.lineWidth = 6 + k * 7;
    g.beginPath(); g.ellipse(w * 0.52, vy(0.5), w * 0.34, h * 0.135, 0, 0, Math.PI * 2); g.stroke();
  }
  // the mouth: dark inside; white teeth with warm brown grooves running out across each lip
  const vpx = h / (Math.PI * 2);
  for (const off of [0, -h]) {
    for (let x = 0; x <= w; x += 2) {
      const u = x / w, s = u * 2 - 1;
      if (Math.abs(s) > 0.97) continue;
      const y = vy(slitC(s) / (Math.PI * 2)) + off;
      const half = slitW(s) * vpx;
      const sg = g.createLinearGradient(0, y - half * 1.15, 0, y + half * 1.15);
      sg.addColorStop(0, 'rgba(120,80,50,0)'); sg.addColorStop(0.2, 'rgba(92,58,36,1)'); sg.addColorStop(0.5, 'rgba(34,20,12,1)');
      sg.addColorStop(0.8, 'rgba(92,58,36,1)'); sg.addColorStop(1, 'rgba(120,80,50,0)');
      g.fillStyle = sg; g.fillRect(x, y - half * 1.15, 2, half * 2.3);
      if (Math.abs(s) > S0) continue;
      for (const side of [0, 1]) {
        const groove = 1 - tooth(s, side);
        const a0 = half * 0.95, a1 = half + LIPW * vpx * 0.85;
        const gg = side === 0 ? g.createLinearGradient(0, y - a0, 0, y - a1) : g.createLinearGradient(0, y + a0, 0, y + a1);
        gg.addColorStop(0, `rgba(112,66,32,${(0.95 * groove).toFixed(3)})`); gg.addColorStop(0.55, `rgba(150,100,56,${(0.55 * groove).toFixed(3)})`); gg.addColorStop(1, 'rgba(170,120,70,0)');
        g.fillStyle = gg;
        if (side === 0) g.fillRect(x, y - a1, 2, a1 - a0); else g.fillRect(x, y + a0, 2, a1 - a0);
      }
    }
  }
  // a faint all-over grain so no area is a flat fill
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (hash1(i >> 2) - 0.5) * 7;
    d[i] = Math.max(0, Math.min(255, d[i] + n)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Very fine surface waviness, so the glaze mirrors the room with a slight organic ripple.
function microNormal() {
  const n = 512, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 900; i++) {
    const x = hash1(i * 3 + 1) * n, y = hash1(i * 3 + 2) * n, r = 8 + hash1(i * 3 + 3) * 30;
    const v = hash1(i * 7) < 0.5 ? 114 : 142;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${v},${v},${v},0.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = normalFromHeight(c, 1.0, 2);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

let geoCache = null, texCache = null, nrmCache = null;

// Hard, wet porcelain: a mirror-sharp clear coat over a smooth glaze. Light scatters inside the shell, so shadowed
// parts stay warm and the thin edges glow faintly (faked translucency, strongest at grazing angles).
export function cowrieMaterial(env = null) {
  if (!texCache) texCache = cowrieTexture();
  if (!nrmCache) nrmCache = microNormal();
  const mat = new THREE.MeshPhysicalMaterial({
    map: texCache, normalMap: nrmCache, normalScale: new THREE.Vector2(0.1, 0.1),
    roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.015, specularIntensity: 0.5, ior: 1.52,
    envMapIntensity: 1.7,
  });
  // Built-in studio reflections (window, front card, bounce from below). A stage that brings its own
  // environment gets a light touch; one that doesn't (it lights the shell with its own lamps only) gets the full studio.
  const studio = { value: env ? new THREE.Vector3(9, 2.5, 3) : new THREE.Vector3(9, 12, 4) };
  mat.userData.studio = studio;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uStudio = studio;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uStudio;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float ndv = clamp(abs(dot(normal, geometryViewDir)), 0.0, 1.0);
      float rimT = pow(1.0 - ndv, 2.5);
      outgoingLight += diffuseColor.rgb * (vec3(1.0, 0.8, 0.52) * rimT * 0.22 + vec3(1.0, 0.86, 0.62) * 0.035);
      // the open mouth is a hole into the dark inside of the shell: no glaze reflections there
      float mouth = smoothstep(0.34, 0.1, dot(diffuseColor.rgb, vec3(0.3333)));
      // a studio softbox up and to the left of the camera, mirrored crisply in the glaze (as in a product shot),
      // so the shell reads as wet porcelain under any stage's lighting
      vec3 Rv = reflect(-geometryViewDir, normal);
      vec2 q = Rv.xy / max(Rv.z, 0.05);
      float box = smoothstep(0.36, 0.28, abs(q.x + 0.55)) * smoothstep(0.27, 0.19, abs(q.y - 0.5)) * step(0.0, Rv.z);
      // and a broad, dim bounce card in front, so faces turned to the camera still show the glaze
      float card = smoothstep(0.2, 0.75, Rv.z) * (0.45 + 0.55 * smoothstep(-0.6, 0.6, q.y));
      // warm light bouncing up from below (a tabletop or the sea), for faces turned down
      float below = smoothstep(-0.3, -0.85, Rv.y);
      float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      outgoingLight += (vec3(1.0, 0.96, 0.9) * (uStudio.x * box + uStudio.y * card) + vec3(1.0, 0.86, 0.66) * uStudio.z * below) * fres;
      outgoingLight *= mix(1.0, 0.18, mouth);
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'verse1-cowrie-porcelain-8';
  if (env) mat.envMap = env;
  return mat;
}

// A studio environment for the shell: a small bright window for the sharp wet highlight, a soft fill,
// a cool strip and a warm backlight.
export function cowrieEnv(renderer) {
  return studioEnv(renderer, [
    { pos: [2.5, 4, 5], size: [1.4, 1.0], color: [1, 0.97, 0.92], intensity: 6 },
    { pos: [-2, 3, 5], size: [5, 3.5], color: [1, 0.97, 0.92], intensity: 0.8 },
    { pos: [-5, 1.5, 2], size: [0.6, 4], color: [0.85, 0.95, 1], intensity: 2.0 },
    { pos: [0, 1.2, -7], size: [3, 3], color: [1, 0.96, 0.88], intensity: 2.0 },
  ], { top: [0.12, 0.16, 0.18], horizon: [0.05, 0.1, 0.11], bottom: [0.03, 0.04, 0.045] });
}

// The cowrie on its own, for anyone to place and scale.
// Returns a THREE.Group: origin at the shell's centre, long axis X, back up (+Y), toothed mouth down (-Y),
// overall length = `length` (world units). Shares geometry and texture between calls.
export function cowrie({ length = 0.25, env = null, material = null } = {}) {
  if (!geoCache) geoCache = cowrieGeometry();
  const mat = material || cowrieMaterial(env);
  const mesh = new THREE.Mesh(geoCache, mat);
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  g.scale.setScalar(length);
  g.userData = { mesh, mat };
  return g;
}

// A cowrie pendant hung by one end: the cord runs through a hole drilled in the tip, so the shell hangs
// long axis vertical and turns on its cord, showing the toothed base, then the back.
// The group origin is the hang point; `spinner` turns about the cord, `holder` tilts it.
export function hangingCowrie({ length = 0.25, cord = 1.6, env = null } = {}) {
  const group = new THREE.Group();
  const shellG = cowrie({ length, env });
  const holder = new THREE.Group();
  const spinner = new THREE.Group();
  shellG.rotation.z = -Math.PI / 2;        // long axis vertical, the narrow (anterior, -X) end up
  shellG.position.y = -0.5 * length * 0.97; // the top tip sits at the hang point
  spinner.add(shellG);
  holder.add(spinner);
  group.add(holder);
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    pts.push(new THREE.Vector3(Math.sin(u * 2.1) * 0.012, u * cord, Math.sin(u * 1.3 + 1) * 0.01));
  }
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 });
  const cordMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.0028, 6, false), cordMat);
  cordMesh.position.y = -0.006;
  group.add(cordMesh);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 16, 12), cordMat);
  knot.scale.set(1.2, 0.8, 1.2);
  knot.position.y = -0.003;
  group.add(knot);
  return { group, holder, spinner, shell: shellG.userData.mesh, mat: shellG.userData.mat, cord: cordMesh };
}
