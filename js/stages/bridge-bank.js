// The bank (bridge, 112.23-116.96): a stone temple of money at night under alarm-red light.
// It shakes on the hits and cracks spread across its carved motto; a torrent of new notes pours into it
// from the sky; the savers' heap of coins at its door drains into a crack in the stone.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { NoteCloud } from '../props/notes.js';
import { METALS } from '../props/coin.js';
import { coinFace, normalFromHeight } from '../tex.js';
import { bridgeNote, readableBothSides } from '../props/bridge-note.js';
import { clamp, hash1, lerp, rng, smooth, easeOut, easeIn } from '../util.js';

// Layout (bank space: columns stand on the stylobate top at y = 0, column axes at z = 0).
export const BANK = {
  colX: [-7.25, -4.35, -1.45, 1.45, 4.35, 7.25],
  shaftH: 7.6, capTop: 8.35, archTop: 9.3, friezeTop: 10.65, corniceTop: 11.1, apex: 13.7,
  halfW: 8.4, corniceHalfW: 8.85,
  stepH: 0.36, stepD: 0.7, steps: 5, styFront: 1.6,
  crackRect: [-9.6, -2.3, 19.2, 16.4],
};
export const HEAP = { z: 0.95, r: 0.62 };   // the savers' coins, on the stylobate in front of the door
export const stepTop = (i) => -BANK.stepH * i;                 // i = 0 (stylobate) .. 5
export const stepFront = (i) => BANK.styFront + BANK.stepD * i;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function texOf(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// Pale limestone: colour and a subtle pitted normal map. Tiles every 4 units.
function limestone() {
  const S = 1024, c = canvas(S, S), g = c.getContext('2d'), hc = canvas(S, S), h = hc.getContext('2d');
  const R = rng(19);
  g.fillStyle = '#cbc3b4'; g.fillRect(0, 0, S, S);
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  const wrapArc = (ctx, x, y, r) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (x + ox < -r || x + ox > S + r || y + oy < -r || y + oy > S + r) continue;
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
    }
  };
  for (let i = 0; i < 260; i++) {
    const v = R();
    g.fillStyle = v < 0.5 ? `rgba(120,108,92,${0.03 + R() * 0.05})` : `rgba(235,230,220,${0.03 + R() * 0.05})`;
    wrapArc(g, R() * S, R() * S, 30 + R() * 140);
  }
  for (let i = 0; i < 9000; i++) {
    const x = R() * S, y = R() * S, r = 0.4 + R() * R() * 2.2;
    g.fillStyle = `rgba(70,62,52,${R() * 0.18})`; wrapArc(g, x, y, r);
    h.fillStyle = `rgba(0,0,0,${R() * 0.4})`; wrapArc(h, x, y, r);
  }
  // faint bedding lines
  for (let i = 0; i < 26; i++) {
    const y = R() * S;
    g.strokeStyle = `rgba(110,98,84,${0.04 + R() * 0.06})`; g.lineWidth = 1 + R() * 3;
    g.beginPath();
    for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6);
    g.stroke();
  }
  return { map: texOf(c), normal: (() => { const n = normalFromHeight(hc, 1.4, 1); n.wrapS = n.wrapT = THREE.RepeatWrapping; return n; })() };
}

// The carved frieze: the bank's motto cut into the stone (dark recessed letters, bevelled in the normal map).
function friezeTextures(text) {
  const W = 2048, H = Math.round(2048 * (BANK.friezeTop - BANK.archTop) / (BANK.halfW * 2));
  const col = canvas(W, H), g = col.getContext('2d'), hc = canvas(W, H), h = hc.getContext('2d');
  h.fillStyle = '#fff'; h.fillRect(0, 0, W, H);
  g.clearRect(0, 0, W, H);
  const font = `700 ${Math.round(H * 0.72)}px "Cormorant Garamond"`;
  for (const ctx of [g, h]) { ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
  // letter-spaced
  const spaced = text;
  for (const ctx of [g, h]) ctx.letterSpacing = `${Math.round(H * 0.09)}px`;
  h.filter = 'blur(2px)'; h.fillStyle = '#000'; h.fillText(spaced, W / 2, H * 0.55); h.filter = 'none';
  g.fillStyle = 'rgba(40,32,26,0.78)'; g.fillText(spaced, W / 2, H * 0.55);
  // guide fillets above and below the letters
  g.fillStyle = 'rgba(60,50,40,0.35)'; g.fillRect(0, H * 0.06, W, 3); g.fillRect(0, H * 0.94, W, 3);
  h.fillStyle = '#000'; h.fillRect(0, H * 0.06, W, 3); h.fillRect(0, H * 0.94, W, 3);
  const letters = texOf(col, { repeat: false });
  const normal = normalFromHeight(hc, 2.4, 1.5);
  return { letters, normal, aspect: W / H };
}

// Crack atlas over the facade: G = crack coverage, R/G = arrival (0..1) so cracks can grow with a threshold.
function crackTexture() {
  const [x0, y0, w, h] = BANK.crackRect;
  const CW = 2048, CH = Math.round(2048 * h / w);
  const c = canvas(CW, CH), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, CW, CH);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const px = (x) => ((x - x0) / w) * CW, py = (y) => (1 - (y - y0) / h) * CH;
  const R = rng(2008);
  // A crack is a jittery path that may branch. Arrival runs a0 -> a1 along it.
  function crack(x, y, ang, len, width, a0, a1, bounds, depth = 0) {
    let s = 0;
    const step = 0.09;
    while (s < len) {
      const a = lerp(a0, a1, s / len);
      ang += (R() - 0.5) * 0.7;
      const nx = x + Math.cos(ang) * step, ny = y + Math.sin(ang) * step;
      if (bounds && (nx < bounds[0] || nx > bounds[1])) { ang = Math.PI - ang; continue; }
      const wid = Math.max(1.2, width * (1 - 0.6 * s / len));
      g.strokeStyle = `rgb(${Math.round(a * 255)},255,0)`;
      g.lineWidth = wid;
      g.beginPath(); g.moveTo(px(x), py(y)); g.lineTo(px(nx), py(ny)); g.stroke();
      x = nx; y = ny; s += step;
      if (depth < 3 && R() < 0.035) {
        const side = R() < 0.5 ? -1 : 1;
        crack(x, y, ang + side * (0.5 + R() * 0.6), (len - s) * (0.3 + R() * 0.4), wid * 0.6, a, Math.min(1, a + (a1 - a) * 0.8), bounds, depth + 1);
      }
    }
  }
  const down = -Math.PI / 2;
  const cx = BANK.colX;
  // 1. through the motto near FAIL, down the architrave and into a column
  crack(4.95, 11.05, down - 0.15, 3.3, 12, 0.0, 0.26, null);
  crack(4.55, 8.3, down, 5.2, 10, 0.26, 0.5, [cx[4] - 0.35, cx[4] + 0.35]);
  // 2. from the pediment's apex down through the tympanum into the frieze
  crack(0.2, 13.55, down + 0.35, 4.4, 10, 0.24, 0.6, null);
  // 3. along the frieze, splitting the motto
  crack(4.4, 9.95, Math.PI + 0.05, 12.8, 9, 0.42, 0.86, [-8.2, 8.2]);
  // 4. the left architrave
  crack(-8.3, 9.05, -0.2, 3.8, 8, 0.55, 0.85, [-8.4, 8.4]);
  // 5-7. columns
  crack(cx[1] + 0.1, 8.25, down, 6.2, 10, 0.5, 0.88, [cx[1] - 0.35, cx[1] + 0.35]);
  crack(cx[2] - 0.05, 8.25, down, 3.6, 8, 0.74, 1.0, [cx[2] - 0.35, cx[2] + 0.35]);
  crack(cx[5], 8.25, down, 4.8, 8, 0.78, 1.0, [cx[5] - 0.35, cx[5] + 0.35]);
  // 8. across the steps
  crack(-5.5, -0.1, -0.08, 11, 8, 0.72, 1.0, [-9, 9]);
  crack(1.8, -0.05, down + 0.6, 3.2, 8, 0.8, 1.0, null);
  const t = texOf(c, { srgb: false, repeat: false });
  t.generateMipmaps = true;
  return t;
}

// Inject bank-space crack lookup into a standard material.
function crackify(mat, U) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform mat4 uBankInv; varying vec3 vBankPos; varying vec3 vBankNrm;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vBankPos = (uBankInv * modelMatrix * vec4(transformed, 1.0)).xyz;
        vBankNrm = normalize(mat3(uBankInv) * mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uCrackTex; uniform float uCrack; uniform vec4 uCrackRect; uniform vec3 uCrackGlow;
        varying vec3 vBankPos; varying vec3 vBankNrm;
        float crackM = 0.0;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 cuv = (vBankPos.xy - uCrackRect.xy) / uCrackRect.zw;
          if (cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0 && vBankNrm.z > 0.45) {
            vec4 cs = texture2D(uCrackTex, cuv);
            float arr = cs.r / max(cs.g, 0.004);
            crackM = cs.g * (1.0 - smoothstep(uCrack - 0.02, uCrack, arr));
          }
          diffuseColor.rgb *= 1.0 - 0.93 * crackM;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uCrackGlow * crackM;`);
  };
  mat.customProgramCacheKey = () => 'bridge-crack';
  return mat;
}

// Box-projected UVs in bank units so one tiling texture sits at the same scale on every block.
function boxUV(geo, offset = [0, 0, 0], scale = 0.25) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + offset[0], y = p.getY(i) + offset[1], z = p.getZ(i) + offset[2];
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (az >= ax && az >= ay) uv.setXY(i, x * scale, y * scale);
    else if (ax >= ay) uv.setXY(i, z * scale, y * scale);
    else uv.setXY(i, x * scale, z * scale);
  }
  uv.needsUpdate = true;
  return geo;
}

// A fluted Doric shaft with entasis.
function columnGeometry() {
  const H = BANK.shaftH, r0 = 0.62, r1 = 0.52, flutes = 20, radial = 160, rings = 24;
  const g = new THREE.CylinderGeometry(1, 1, H, radial, rings, true);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const v = (y + H / 2) / H;
    const a = Math.atan2(z, x);
    const ent = lerp(r0, r1, v) + Math.sin(v * Math.PI) * 0.018;
    const f = Math.abs(Math.cos((a * flutes) / 2));
    const r = ent * (1 - 0.055 * (1 - Math.pow(f, 0.6)));
    p.setXYZ(i, Math.cos(a) * r, y + H / 2, Math.sin(a) * r);
    uv.setXY(i, (a / (Math.PI * 2)) * 4 * 0.7, (y + H / 2) * 0.25);
  }
  g.computeVertexNormals();
  return g;
}
function echinusGeometry() {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    pts.push(new THREE.Vector2(0.53 + 0.34 * Math.pow(u, 1.6), BANK.shaftH + u * 0.42));
  }
  pts.push(new THREE.Vector2(0.001, BANK.shaftH + 0.42));
  const g = new THREE.LatheGeometry(pts, 96);
  return g;
}

function sprite() {
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export async function bankStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050101);
  scene.fog = new THREE.FogExp2(0x0a0202, 0.012);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 3], size: [6, 1.2], color: [1, 0.95, 0.9], intensity: 3 },
    { pos: [-6, 0.5, 2], size: [0.8, 4], color: [1, 0.2, 0.12], intensity: 4 },
    { pos: [6, 0.5, 1], size: [0.8, 4], color: [1, 0.2, 0.12], intensity: 3 },
    { pos: [0, -1, 6], size: [8, 1], color: [0.9, 0.9, 1], intensity: 1.5 },
  ], { top: [0.08, 0.02, 0.02], horizon: [0.12, 0.03, 0.02], bottom: [0.01, 0.0, 0.0] });
  scene.environmentIntensity = 0.9;

  // Sky: black above, a low red glow on the horizon behind the bank.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uGlow: { value: new THREE.Color(0.55, 0.05, 0.02) }, uGain: { value: 1 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uGlow; uniform float uGain; varying vec3 vP;
      void main(){ float h = vP.y; float g = exp(-abs(h - 0.02) * 9.0) * smoothstep(-0.2, 0.02, h);
        gl_FragColor = vec4(uGlow * g * uGain, 1.0); }`,
  }));
  scene.add(sky);

  const bank = new THREE.Group();
  scene.add(bank);

  const stone = limestone();
  const crackTex = crackTexture();
  const U = {
    uCrackTex: { value: crackTex }, uCrack: { value: 0 },
    uCrackRect: { value: new THREE.Vector4(...BANK.crackRect) },
    uCrackGlow: { value: new THREE.Color(0, 0, 0) },
    uBankInv: { value: new THREE.Matrix4() },
  };
  const stoneMat = crackify(new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.86, metalness: 0, color: 0xe2dbcf }), U);
  const plainStone = new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.9, metalness: 0, color: 0xc9c1b4 });

  const add = (geo, mat, pos, parent = bank) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, pos, mat = stoneMat) => add(boxUV(new THREE.BoxGeometry(w, h, d), pos), mat, pos);

  // Steps and stylobate.
  const back = -5.2;
  for (let i = 0; i <= BANK.steps; i++) {
    const top = stepTop(i), front = stepFront(i);
    const hw = 9.3 + i * 0.35;
    const bottom = stepTop(i + 1);
    box(hw * 2, top - bottom, front - back, [0, (top + bottom) / 2, (front + back) / 2]);
  }
  // Columns.
  const colGeo = columnGeometry();
  const echGeo = echinusGeometry();
  const columns = [];
  for (const x of BANK.colX) {
    const c = add(colGeo, stoneMat, [x, 0, 0]);
    add(echGeo, stoneMat, [x, 0, 0]);
    box(1.78, 0.33, 1.78, [x, BANK.capTop - 0.165, 0]);
    columns.push(c);
  }
  // Entablature.
  const { halfW, archTop, friezeTop, corniceTop, capTop, apex, corniceHalfW } = BANK;
  box(halfW * 2, archTop - capTop, 5.6, [0, (capTop + archTop) / 2, -2.0]);
  // Frieze, with the bank's motto carved into its face (letters ride on a thin overlay so the stone keeps its scale).
  box(halfW * 2 - 0.1, friezeTop - archTop, 5.5, [0, (archTop + friezeTop) / 2, -2.05]);
  const fr = friezeTextures('TOO BIG TO FAIL');
  const letterMat = crackify(new THREE.MeshStandardMaterial({
    map: fr.letters, normalMap: fr.normal, normalScale: new THREE.Vector2(1.8, 1.8), transparent: true, roughness: 0.9, color: 0xffffff,
    polygonOffset: true, polygonOffsetFactor: -2,
  }), U);
  const letters = add(new THREE.PlaneGeometry(halfW * 2 - 0.3, friezeTop - archTop - 0.08), letterMat, [0, (archTop + friezeTop) / 2, 0.704]);
  letters.castShadow = false;
  // Cornice (two stacked slabs for a moulded edge).
  box(corniceHalfW * 2, 0.18, 6.4, [0, friezeTop + 0.09, -2.0]);
  box(corniceHalfW * 2 + 0.3, corniceTop - friezeTop - 0.18, 6.8, [0, (friezeTop + 0.18 + corniceTop) / 2, -2.0]);
  // Pediment: tympanum + raking cornices.
  const ph = apex - corniceTop;
  const tri = new THREE.Shape();
  tri.moveTo(-corniceHalfW + 0.3, 0); tri.lineTo(corniceHalfW - 0.3, 0); tri.lineTo(0, ph - 0.35); tri.lineTo(-corniceHalfW + 0.3, 0);
  const tym = new THREE.ExtrudeGeometry(tri, { depth: 5.4, bevelEnabled: false });
  tym.translate(0, 0, -5.4);
  boxUV(tym, [0, corniceTop, 0.7]);
  add(tym, stoneMat, [0, corniceTop, 0.7]);
  const rakeLen = Math.hypot(corniceHalfW + 0.15, ph);
  const rakeAng = Math.atan2(ph, corniceHalfW + 0.15);
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(rakeLen + 0.2, 0.42, 6.9);
    const m = new THREE.Mesh(g, stoneMat);
    m.position.set(s * (corniceHalfW + 0.15) / 2, corniceTop + ph / 2 - 0.02, -2.0);
    m.rotation.z = -s * rakeAng;
    m.castShadow = m.receiveShadow = true;
    boxUV(g, [0, 0, 0]);
    bank.add(m);
  }
  // Roof slopes (dark lead) so the torrent has something to fall into.
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.6, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(rakeLen, 0.2, 7.2);
    const m = new THREE.Mesh(g, roofMat);
    m.position.set(s * corniceHalfW / 2, corniceTop + ph / 2 + 0.05, -2.3);
    m.rotation.z = -s * rakeAng;
    bank.add(m);
  }
  // Cella wall with a tall doorway; green light waits inside.
  const wallZ = -2.6;
  const doorW = 3.0, doorH = 5.6;
  box((halfW - 0.8) - doorW / 2, capTop, 0.8, [-(doorW / 2 + (halfW - 0.8 - doorW / 2) / 2), capTop / 2, wallZ - 0.4], plainStone);
  box((halfW - 0.8) - doorW / 2, capTop, 0.8, [(doorW / 2 + (halfW - 0.8 - doorW / 2) / 2), capTop / 2, wallZ - 0.4], plainStone);
  box(doorW, capTop - doorH, 0.8, [0, doorH + (capTop - doorH) / 2, wallZ - 0.4], plainStone);
  for (const sx of [-1, 1]) box(0.8, capTop, 2.6, [sx * 8.0, capTop / 2, -3.9], plainStone);
  const vaultMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.05, 0.03) });
  const vault = add(new THREE.PlaneGeometry(doorW, doorH), vaultMat, [0, doorH / 2, wallZ - 1.2]);
  vault.castShadow = false;
  // bronze door leaves, standing open
  const doorMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.32, 0.2, 0.1), metalness: 1, roughness: 0.38 });
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW / 2, doorH, 0.12), doorMat);
    leaf.geometry.translate(-s * doorW / 4, 0, 0);
    leaf.position.set(s * doorW / 2, doorH / 2, wallZ - 0.1);
    leaf.rotation.y = s * 1.1;
    bank.add(leaf);
  }

  // Light: a cold floodlight from below, alarm red from both sides, red rim behind, green from above for the bailout.
  const flood = new THREE.SpotLight(0xe4eaff, 300, 70, 0.62, 0.55, 1.5);
  flood.position.set(0, -2.6, 14);
  flood.target.position.set(0, 7, 0);
  flood.castShadow = true;
  flood.shadow.mapSize.set(2048, 2048);
  flood.shadow.bias = -0.0003;
  scene.add(flood, flood.target);
  // Alarm red lives behind the columns: it floods the cella wall so the white columns stand against red.
  const redL = new THREE.PointLight(0xff2010, 14, 8.5, 1.4);
  redL.position.set(-4.4, 5.5, -1.3);
  const redR = new THREE.PointLight(0xff2010, 14, 8.5, 1.4);
  redR.position.set(4.4, 5.5, -1.3);
  scene.add(redL, redR);
  const rimRed = new THREE.DirectionalLight(0xff3018, 0.9);
  rimRed.position.set(0, 6, -10);
  scene.add(rimRed);
  const green = new THREE.SpotLight(0x8dffb0, 0, 80, 0.35, 0.7, 1.2);
  green.position.set(0, 40, 2); green.target.position.set(0, 8, -2);
  scene.add(green, green.target);
  const coinKey = new THREE.SpotLight(0xf6f2ea, 0, 20, 0.42, 0.6, 1.2);
  coinKey.position.set(-1.4, 3.4, 3.8);
  coinKey.target.position.set(0, 0, HEAP.z);
  coinKey.castShadow = true;
  coinKey.shadow.mapSize.set(1024, 1024);
  coinKey.shadow.bias = -0.0004;
  scene.add(coinKey, coinKey.target);
  const vaultLight = new THREE.PointLight(0x7dffa0, 0, 14, 1.6);
  vaultLight.position.set(0, 2.5, wallZ + 0.8);
  scene.add(vaultLight);
  const amb = new THREE.AmbientLight(0x1c1010, 0.5);
  scene.add(amb);

  // Dust shaken loose on every hit.
  const DUST_PER = 320;
  const HITS = [112.233, 112.867, 113.533, 114.033, 114.833, 116.133, 116.667];
  const ND = DUST_PER * HITS.length;
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
    size: 0.55, map: sprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true,
  }));
  dust.frustumCulled = false;
  bank.add(dust);

  // The bailout: notes pouring from the sky into the bank.
  const noteTex = await bridgeNote();
  const torrent = new NoteCloud(noteTex, 2600, { emissive: 0.1 });
  readableBothSides(torrent.material, 'torrent');
  scene.add(torrent);

  // The savers' coins: a small heap on the stylobate at the bank's door, and the crack that swallows it.
  const heapFaces = [await coinFace('denarius', { size: 512 }), await coinFace('stater', { size: 512 })];
  const coinGeo = new THREE.CylinderGeometry(1, 1, 1, 48);
  // The coins reflect a neutral studio of their own, so silver reads as silver under the alarm-red scene.
  const coinEnv = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 2], color: [1, 1, 1], intensity: 3 },
    { pos: [-5, 2, 3], size: [1, 4], color: [1, 0.96, 0.9], intensity: 2.5 },
    { pos: [5, 1, -2], size: [1, 4], color: [0.92, 0.95, 1], intensity: 2 },
  ], { top: [0.4, 0.4, 0.4], horizon: [0.14, 0.13, 0.12], bottom: [0.02, 0.02, 0.02] });
  const mkCoins = (metal, face, count) => {
    const m = METALS[metal];
    const col = new THREE.Color().setRGB(...m.color);
    const faceMat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 1, roughness: m.roughness + 0.05, map: face.color, normalMap: face.normal, normalScale: new THREE.Vector2(1.2, 1.2), envMap: coinEnv });
    const edgeMat = new THREE.MeshPhysicalMaterial({ color: col, metalness: 1, roughness: m.roughness + 0.12, envMap: coinEnv });
    const im = new THREE.InstancedMesh(coinGeo, [edgeMat, faceMat, faceMat], count);
    im.castShadow = true; im.receiveShadow = true;
    im.frustumCulled = false;
    bank.add(im);
    return im;
  };
  const Rh = rng(1160);
  const heap = [];
  const layers = [26, 20, 15, 10, 6, 3];
  layers.forEach((n, L) => {
    const R = HEAP.r * (1 - L * 0.16);
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      const rr = Math.sqrt(u) * R * (0.85 + 0.15 * Rh());
      const ang = k * 2.39996 + L * 0.7 + Rh() * 0.4;
      heap.push({
        x: Math.cos(ang) * rr, z: HEAP.z + Math.sin(ang) * rr * 0.9, y: 0.012 + L * 0.024 + Rh() * 0.006, L,
        rad: 0.13 + Rh() * 0.035, tx: (Rh() - 0.5) * (0.25 + 0.08 * L), tz: (Rh() - 0.5) * (0.25 + 0.08 * L), spin: Rh() * 6.28,
        silver: Rh() < 0.6, j: Rh(),
      });
    }
  });
  const nSilver = heap.filter((c) => c.silver).length;
  const silverCoins = mkCoins('silver', heapFaces[0], nSilver);
  const bronzeCoins = mkCoins('bronze', heapFaces[1], heap.length - nSilver);
  // The gap: a jagged black lens across the stone under the heap that opens on "savers".
  const gapShape = new THREE.Shape();
  const Rg = rng(77);
  const GN = 26, GL = 0.95;
  const edgeTop = [], edgeBot = [];
  for (let i = 0; i <= GN; i++) {
    const x = -GL + (2 * GL * i) / GN;
    const w = 0.27 * Math.max(0, 1 - (x / GL) ** 2) ** 0.8;
    edgeTop.push([x, w + (Rg() - 0.5) * 0.06 * (w > 0.02 ? 1 : 0)]);
    edgeBot.push([x, -w + (Rg() - 0.5) * 0.06 * (w > 0.02 ? 1 : 0)]);
  }
  gapShape.moveTo(edgeTop[0][0], 0);
  for (const [x, y] of edgeTop) gapShape.lineTo(x, y);
  for (let i = edgeBot.length - 1; i >= 0; i--) gapShape.lineTo(edgeBot[i][0], edgeBot[i][1]);
  const gap = new THREE.Mesh(new THREE.ShapeGeometry(gapShape), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  gap.rotation.x = -Math.PI / 2;
  gap.position.set(0, 0.003, HEAP.z);
  bank.add(gap);

  const dcol = new THREE.Color();
  const dm = new THREE.Object3D();
  const S = {
    scene, bank, columns, flood, redL, redR, rimRed, green, coinKey, vaultLight, vaultMat, amb, sky, dust, torrent, gap, silverCoins, bronzeCoins, U,
    fx: { bloom: 0.45, threshold: 1.1, bloomRadius: 0.35, grain: 0.055, vignette: 0.55, tint: [1.04, 0.97, 0.95], contrast: 1.08 },
    HITS,
    // Crack growth: each hit of the line snaps the cracks further.
    crackAt(t) {
      const steps = [[112.233, 0.3], [112.867, 0.47], [113.533, 0.72], [114.033, 1.0]];
      let k = 0;
      for (const [th, v] of steps) if (t >= th) k = lerp(k, v, easeOut(clamp((t - th) / 0.14), 2));
      return k;
    },
    // Shudder: a damped jolt from every hit, strongest on "shook".
    shakeAt(t) {
      const amp = [0.55, 0.5, 0.75, 1.0, 0.45, 0.4, 0.45];
      let x = 0, r = 0;
      HITS.forEach((th, i) => {
        const a = t - th;
        if (a < 0 || a > 1.2) return;
        const e = Math.exp(-a * 6) * amp[i];
        x += Math.sin(a * 42 + i) * e * 0.07;
        r += Math.sin(a * 37 + i * 2) * e * 0.0045;
      });
      return { x, r };
    },
    // Torrent: notes released from far above at a steady rate, falling fast and fanning out, vanishing into the roof.
    pour(t, t0, { rate = 900, top = 46, speed = 24, radius = 1.2, flare = 0.09, cx = 0, cz = -2.4, scale = 0.5 } = {}) {
      torrent.visible = true;
      torrent.setTime(t);
      torrent.setFlutter(1);
      const age0 = t - t0;
      const n = Math.min(torrent.capacity, Math.max(0, Math.floor(age0 * rate)));
      const roof = (x) => corniceTop + Math.max(0, ph - 0.35 - Math.abs(x) * (ph / corniceHalfW));
      torrent.layout(n, (i, d) => {
        const e = t0 + i / rate;
        const a = t - e;
        const fall = speed * a + 4.9 * a * a;
        const y = top - fall;
        const h1 = hash1(i * 5 + 1), h2 = hash1(i * 5 + 2), h3 = hash1(i * 5 + 3), h4 = hash1(i * 5 + 4);
        const rr = (radius + fall * flare) * Math.sqrt(h1);
        const ang = h2 * Math.PI * 2 + a * (0.6 + h3);
        const x = cx + Math.cos(ang) * rr, z = cz + Math.sin(ang) * rr * 0.8;
        if (y < roof(x) - 0.2) return false;
        d.position.set(x, y, z);
        d.rotation.set(a * (h3 - 0.5) * 7 + h4 * 6, a * (h1 - 0.5) * 6, a * (h4 - 0.5) * 5 + h2 * 6);
        d.scale.setScalar(scale * (0.85 + 0.3 * h3));
      });
    },
    // The heap drains: the gap opens at tOpen, coins nearest the crack go first, sliding in and dropping into the dark.
    heapAt(t, tOpen) {
      const open = easeOut(clamp((t - tOpen) / 0.22), 2);
      gap.visible = open > 0.001;
      gap.scale.set(1, Math.max(0.001, open), 1);
      let si = 0, bi = 0;
      for (const c of heap) {
        const ts = tOpen + 0.06 + Math.abs(c.z - HEAP.z) * 0.6 + c.L * 0.035 + Math.abs(c.x) * 0.15 + c.j * 0.06;
        const a = t - ts;
        let x = c.x, y = c.y, z = c.z, rx = c.tx, rz = c.tz, ry = c.spin, s = c.rad;
        if (a > 0) {
          const slide = easeIn(clamp(a / 0.2), 2);
          z = lerp(c.z, HEAP.z, slide);
          y = lerp(c.y, 0.012, slide);
          rx = c.tx + slide * (c.j - 0.5) * 1.2;
          const b = Math.max(0, a - 0.16);
          y -= 4.9 * 1.8 * b * b;
          rx += b * (6 + 5 * c.j);
          rz = c.tz + b * 4 * (c.j - 0.3);
          if (y < -1.4) s = 0.0001;
        }
        dm.position.set(x, y, z);
        dm.rotation.set(rx, ry, rz);
        dm.scale.set(s, 0.022, s);
        dm.updateMatrix();
        if (c.silver) silverCoins.setMatrixAt(si++, dm.matrix); else bronzeCoins.setMatrixAt(bi++, dm.matrix);
      }
      silverCoins.instanceMatrix.needsUpdate = true;
      bronzeCoins.instanceMatrix.needsUpdate = true;
      silverCoins.visible = bronzeCoins.visible = true;
    },
    update(ctx) {
      const t = ctx.t;
      const sh = this.shakeAt(t);
      bank.position.set(sh.x, 0, 0);
      bank.rotation.set(0, 0, sh.r);
      bank.updateMatrixWorld(true);
      U.uBankInv.value.copy(bank.matrixWorld).invert();
      U.uCrack.value = this.crackAt(t);
      U.uCrackGlow.value.setRGB(0, 0, 0);
      // Alarm: red lights pulse on the beat.
      const k = ctx.T.kick(t, 5);
      redL.intensity = redR.intensity = 10 + 22 * k;
      rimRed.intensity = 0.9;
      flood.intensity = 300;
      green.intensity = 0;
      coinKey.intensity = 0;
      scene.environmentIntensity = 0.9;
      vaultLight.intensity = 0;
      vaultMat.color.setRGB(0.02, 0.05, 0.03);
      sky.material.uniforms.uGain.value = 1;
      scene.fog.density = 0.012;
      torrent.visible = false;
      silverCoins.visible = bronzeCoins.visible = false;
      gap.visible = false;
      // Dust: each hit shakes a veil of dust from the cornice and the cracks.
      const pa = dust.geometry.attributes.position.array, ca = dust.geometry.attributes.color.array;
      for (let h = 0; h < HITS.length; h++) {
        const a = t - HITS[h];
        for (let j = 0; j < DUST_PER; j++) {
          const i = h * DUST_PER + j;
          const r1 = hash1(i * 4 + 1), r2 = hash1(i * 4 + 2), r3 = hash1(i * 4 + 3), r4 = hash1(i * 4 + 4);
          if (a < 0 || a > 2.4) { pa[i * 3 + 1] = -999; ca[i * 3] = ca[i * 3 + 1] = ca[i * 3 + 2] = 0; continue; }
          const ex = (r1 - 0.5) * corniceHalfW * 2;
          const ey = r2 < 0.6 ? corniceTop - 0.1 : archTop - 0.1 + r3 * 0.6;
          const drift = a * (0.3 + r4 * 0.5);
          pa[i * 3] = ex + (r3 - 0.5) * drift;
          pa[i * 3 + 1] = ey - (1.2 + 2.2 * r4) * a - 1.2 * a * a;
          pa[i * 3 + 2] = 1.3 + r2 * 0.4 + drift * 0.8;
          const f = Math.min(1, a * 8) * Math.max(0, 1 - a / 2.4) * 0.11;
          dcol.setRGB(1, 0.86, 0.78).multiplyScalar(f);
          ca[i * 3] = dcol.r; ca[i * 3 + 1] = dcol.g; ca[i * 3 + 2] = dcol.b;
        }
      }
      dust.geometry.attributes.position.needsUpdate = true;
      dust.geometry.attributes.color.needsUpdate = true;
    },
  };
  return S;
}
