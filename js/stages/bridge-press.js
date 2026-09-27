// The money printer (first half of the break, 102.26-106.37): two giant chrome rollers bolted to an endless wall,
// a green line of light between them, and a continuous printed sheet of bank notes pouring over a curl into a rising
// sea of paper under rows of fluorescent tubes; then the whole wall of printers switches on, one after another.
// Everything is a pure function of song time.
// Flash safety: speeds stay slow enough and lights change smoothly, so no area of the frame flickers.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { normalFromHeight } from '../tex.js';
import { bridgeNote } from '../props/bridge-note.js';
import { NoteCloud, NOTE } from '../props/notes.js';
import { clamp, hash1, lerp, rng, smooth } from '../util.js';

export const PRESS = {
  t0: 102.26,       // the break starts
  tEnd: 106.37,     // the hall's last frame
  R: 1.4,           // roller radius
  L: 10,            // roller length (along x)
  zAxis: 1.6,       // roller axes stand this far in front of the wall
  pitch: 0.532,     // paper travel per printed row (one note's short side on the web)
  r0: 0.8,          // rows per second when the break starts (slow enough that no spot on screen flickers)
  c: 0.3,           // acceleration of the row rate (rows/s^2 / 2): about 3.5 rows/s by the end of the hall
  webLen: 16.2,     // the printed web: out of the nip, over a curl, straight down past the lowest sea level
  spacing: 13.5,    // distance between printers along the wall
  // The printers down the wall switch on in a smooth sweep during the wide shot (each fades up; no pops).
  waveOn: [104.55, 104.75, 104.95, 105.15, 105.35, 105.55, 105.75],
  fadeOn: 0.35,
};

// Rows printed since t0 (negative before). Rate is r0 before t0, then rises linearly.
export function rowsAt(t) {
  const tau = t - PRESS.t0;
  return tau < 0 ? PRESS.r0 * tau : PRESS.r0 * tau + PRESS.c * tau * tau;
}
// The sea of paper rises through the break, faster at the end.
export function seaLevel(t) {
  const u = clamp((t - PRESS.t0) / (PRESS.tEnd - PRESS.t0));
  return lerp(-13, -5.5, u * u * (0.35 + 0.65 * u));
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function texOf(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

function grayNote(note, contrast) {
  const c = canvas(note.width, note.height), g = c.getContext('2d');
  g.filter = `grayscale(1) contrast(${contrast})`;
  g.drawImage(note, 0, 0);
  return c;
}

// A printing plate: rows of engraved notes wrapped around the cylinder (canvas x = around, y = along the axis).
// Every plate on the roller is the same, so the texture is one plate at high resolution, repeated 16 times around and
// 8 along. (The whole roller in one 1024 x 512 texture left each note about 60 pixels, and the close-up blew them up
// into blocks.) One plate is 0.55 around by 1.25 along the roller, so 256 x 512 pixels keeps its pixels square.
function plateTextures(note) {
  const ROWS = 16, LANES = 8, cw = 256, ch = 512;
  const col = canvas(cw, ch), g = col.getContext('2d');
  const hc = canvas(cw, ch), h = hc.getContext('2d');
  g.fillStyle = '#c9cfcb'; g.fillRect(0, 0, cw, ch);
  h.fillStyle = '#ffffff'; h.fillRect(0, 0, cw, ch);
  const gA = grayNote(note, 1.6), gB = grayNote(note, 2.2);
  for (const [ctx, src, alpha] of [[g, gA, 0.55], [h, gB, 1]]) {
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(src, -ch * 0.46, -cw * 0.44, ch * 0.92, cw * 0.88);
    ctx.restore();
  }
  // the plate border groove
  g.strokeStyle = 'rgba(30,36,33,0.7)'; g.lineWidth = 6; g.strokeRect(7, 7, cw - 14, ch - 14);
  h.strokeStyle = '#000'; h.lineWidth = 6; h.strokeRect(7, 7, cw - 14, ch - 14);
  const map = texOf(col, { repeat: true });
  map.repeat.set(ROWS, LANES);
  const normal = normalFromHeight(hc, 1.2, 2);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(ROWS, LANES);
  return { map, normal };
}

// Riveted steel wall panels.
function wallTexture() {
  const S = 1024, c = canvas(S, S), g = c.getContext('2d');
  const R = rng(41);
  g.fillStyle = '#2a312d'; g.fillRect(0, 0, S, S);
  const n = 4, p = S / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 38 + R() * 16;
      g.fillStyle = `rgb(${v - 6},${v},${v - 3})`;
      g.fillRect(i * p + 4, j * p + 4, p - 8, p - 8);
      // grime streaks
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(10,14,12,${R() * 0.12})`;
        g.fillRect(i * p + R() * p, j * p + R() * p * 0.3, 1 + R() * 3, R() * p * 0.7);
      }
      g.fillStyle = 'rgba(160,175,165,0.35)';
      for (const [x, y] of [[14, 14], [p - 14, 14], [14, p - 14], [p - 14, p - 14], [p / 2, 14], [p / 2, p - 14]]) {
        g.beginPath(); g.arc(i * p + x, j * p + y, 4, 0, Math.PI * 2); g.fill();
      }
    }
  }
  return texOf(c, { repeat: true });
}

// A tileable carpet of fallen notes for the sea (shadows baked in).
function seaTexture(note) {
  const S = 2048, c = canvas(S, S), g = c.getContext('2d');
  const R = rng(77);
  // The gaps and shadows between notes stay light: a high-contrast carpet crawls (flickers) when the camera moves.
  g.fillStyle = '#6f7f73'; g.fillRect(0, 0, S, S);
  const nw = 150, nh = nw / 2.35;
  for (let i = 0; i < 1500; i++) {
    const x = R() * S, y = R() * S, a = R() * Math.PI * 2, shade = 0.75 + R() * 0.25;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const px = x + ox, py = y + oy;
        if (px < -nw || px > S + nw || py < -nw || py > S + nw) continue;
        g.save();
        g.translate(px, py); g.rotate(a);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(-nw / 2 + 5, -nh / 2 + 7, nw, nh);
        g.drawImage(note, -nw / 2, -nh / 2, nw, nh);
        g.fillStyle = `rgba(0,0,0,${(1 - shade).toFixed(3)})`;
        g.fillRect(-nw / 2, -nh / 2, nw, nh);
        g.restore();
      }
    }
  }
  return texOf(c, { repeat: true });
}

// A spur gear outline in the XY plane.
function gearGeometry(r, teeth, depth, thick, holes = 5) {
  const s = new THREE.Shape();
  const N = teeth * 10;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ph = ((a * teeth) / (Math.PI * 2)) % 1;
    let k;
    if (ph < 0.12) k = ph / 0.12; else if (ph < 0.42) k = 1; else if (ph < 0.54) k = 1 - (ph - 0.42) / 0.12; else k = 0;
    const rr = r - depth + 2 * depth * k;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  const hub = new THREE.Path(); hub.absarc(0, 0, r * 0.14, 0, Math.PI * 2, true); s.holes.push(hub);
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2;
    const hp = new THREE.Path();
    hp.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.2, 0, Math.PI * 2, true);
    s.holes.push(hp);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 24 });
  g.translate(0, 0, -thick / 2);
  g.computeVertexNormals();
  return g;
}

// The printed web: a continuous sheet of uncut notes (8 across) that leaves the nip, curls over and hangs down.
// Its shape never changes; only the print scrolls along it, so the frame stays calm (no flicker).
function webGeometry() {
  const { L, zAxis, webLen } = PRESS;
  const h0 = 0.55, rc = 1.0, arc = (Math.PI / 2) * rc;
  const along = [];
  for (let i = 0; i <= 12; i++) along.push((h0 * i) / 12);
  for (let i = 1; i <= 24; i++) along.push(h0 + (arc * i) / 24);
  for (let i = 1; i <= 40; i++) along.push(h0 + arc + ((webLen - h0 - arc) * i) / 40);
  const across = 16;
  const pos = [], uv = [], idx = [];
  for (let a = 0; a < along.length; a++) {
    const sArc = along[a];
    let y, z;
    if (sArc <= h0) { y = 0; z = zAxis + sArc; }
    else if (sArc <= h0 + arc) { const th = (sArc - h0) / rc; y = -rc + rc * Math.cos(th); z = zAxis + h0 + rc * Math.sin(th); }
    else { y = -rc - (sArc - h0 - arc); z = zAxis + h0 + rc; }
    // a gentle ripple in the hanging part, like a real sheet
    const hang = Math.max(0, sArc - h0 - arc);
    for (let c = 0; c <= across; c++) {
      const x = -L / 2 * 0.985 + (L * 0.985 * c) / across;
      const ripple = hang > 0 ? Math.sin(x * 0.9 + hang * 0.35) * 0.08 * Math.min(1, hang / 2) : 0;
      pos.push(x, y, z + ripple);
      uv.push((c / across) * 8, sArc / PRESS.pitch);
    }
  }
  const row = across + 1;
  for (let a = 0; a < along.length - 1; a++) {
    for (let c = 0; c < across; c++) {
      const i0 = a * row + c, i1 = i0 + 1, i2 = i0 + row, i3 = i2 + 1;
      idx.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Fresh ink is paler than a finished note: a softer print keeps the scrolling sheet from flickering.
let webPrint = null;
function webTexture(noteCanvas) {
  if (!webPrint) {
    const c = canvas(noteCanvas.width, noteCanvas.height), g = c.getContext('2d');
    g.drawImage(noteCanvas, 0, 0);
    g.fillStyle = 'rgba(226,231,214,0.42)';
    g.fillRect(0, 0, c.width, c.height);
    webPrint = texOf(c, { repeat: true });
  }
  return webPrint;
}

function webMaterial(noteCanvas) {
  const map = webTexture(noteCanvas).clone();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({
    map, side: THREE.DoubleSide, roughness: 0.82, metalness: 0,
    emissive: new THREE.Color(1, 1, 1), emissiveMap: map, emissiveIntensity: 0.1,
  });
  // uLen: how much of the web has come out of the nip (a printer that just started grows its sheet downward).
  mat.userData.uLen = { value: 1e9 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLen = mat.userData.uLen;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n varying float vWebS;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n vWebS = uv.y * ${PRESS.pitch.toFixed(4)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n varying float vWebS; uniform float uLen;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (vWebS > uLen) discard;');
  };
  mat.customProgramCacheKey = () => 'bridge-press-web';
  return mat;
}

export async function pressStage(film) {
  const { R, L, zAxis } = PRESS;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020604);
  scene.fog = new THREE.FogExp2(0x030806, 0.012);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 7, 1], size: [14, 0.35], color: [0.82, 1, 0.88], intensity: 7 },
    { pos: [0, 6, 4], size: [14, 0.35], color: [0.82, 1, 0.88], intensity: 6 },
    { pos: [0, 6.5, -3], size: [14, 0.35], color: [0.82, 1, 0.88], intensity: 6 },
    { pos: [0, -3, 6], size: [14, 2.5], color: [0.35, 1, 0.55], intensity: 1.6 },
    { pos: [-7, 1, 3], size: [0.4, 6], color: [0.8, 1, 0.9], intensity: 3 },
  ], { top: [0.06, 0.09, 0.07], horizon: [0.03, 0.05, 0.04], bottom: [0.01, 0.02, 0.012] });
  scene.environmentIntensity = 1.0;

  // Light: hard fluorescent top light, green glow from the slot, a cold rim from behind.
  const top = new THREE.DirectionalLight(0xe4ffec, 2.4);
  top.position.set(2, 12, 7);
  scene.add(top);
  const rim = new THREE.DirectionalLight(0x9dffbe, 1.2);
  rim.position.set(-4, 3, -8);
  scene.add(rim);
  const nipLight = new THREE.PointLight(0x70ffa0, 4, 9, 2);
  nipLight.position.set(0, -0.2, zAxis + 2.4);
  scene.add(nipLight);
  const amb = new THREE.AmbientLight(0x1c2a22, 1.0);
  scene.add(amb);

  const noteTex = await bridgeNote();
  const noteCanvas = noteTex.image;

  const machine = new THREE.Group();
  scene.add(machine);

  // The wall: a vast riveted face. The printers are bolted to it in a row that runs out of sight.
  const wallMap = wallTexture();
  wallMap.repeat.set(0.5, 0.5);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x9aa39e, map: wallMap, roughness: 0.78, metalness: 0.25 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(600, 260, 2), wallMat);
  wall.position.set(0, 70, -1);
  {
    const uv = wall.geometry.attributes.uv, pos = wall.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * 0.12, (pos.getY(i) + 70) * 0.12);
  }
  machine.add(wall);

  // Shared parts of one printer.
  const plate = plateTextures(noteCanvas);
  const rollerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.86, 0.9, 0.88), metalness: 1, roughness: 0.5,
    map: plate.map, normalMap: plate.normal, normalScale: new THREE.Vector2(0.25, 0.25),
  });
  const capMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.35, 0.38, 0.37), metalness: 1, roughness: 0.35 });
  const rollerGeo = new THREE.CylinderGeometry(R, R, L, 160, 1, false);
  rollerGeo.rotateZ(Math.PI / 2);
  const axleGeo = new THREE.CylinderGeometry(0.28, 0.28, L + 2.2, 32).rotateZ(Math.PI / 2);
  const gap = 0.015;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d2a23, roughness: 0.42, metalness: 0.55 });
  const gearMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.62, 0.66, 0.63), metalness: 1, roughness: 0.3 });
  const fs = new THREE.Shape();
  fs.moveTo(0, -3.4); fs.lineTo(zAxis + 1.3, -3.4); fs.quadraticCurveTo(zAxis + 2.1, -3.4, zAxis + 2.1, -2.6);
  fs.lineTo(zAxis + 2.1, 2.6); fs.quadraticCurveTo(zAxis + 2.1, 3.4, zAxis + 1.3, 3.4); fs.lineTo(0, 3.4); fs.lineTo(0, -3.4);
  const frameGeo = new THREE.ExtrudeGeometry(fs, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
  frameGeo.rotateY(-Math.PI / 2);
  const gearGeo = gearGeometry(R + gap, 28, 0.14, 0.32);
  const nipGeo = new THREE.BoxGeometry(L * 0.995, 0.035, 0.6);
  const haloGeo = new THREE.PlaneGeometry(L + 0.7, 6.1);
  const lampGeo = new THREE.PlaneGeometry(L + 1.6, 0.42);
  const webGeo = webGeometry();

  function makeUnit(x, tOn) {
    const g = new THREE.Group();
    g.position.x = x;
    const mkRoller = (y) => {
      const r = new THREE.Group();
      r.position.set(0, y, zAxis);
      r.add(new THREE.Mesh(rollerGeo, [rollerMat, capMat, capMat]));
      r.add(new THREE.Mesh(axleGeo, capMat));
      g.add(r);
      return r;
    };
    const rollTop = mkRoller(R + gap), rollBot = mkRoller(-R - gap);
    // The light leaking out of the nip: a thin hot line between the rollers, and a halo on the wall behind.
    const nipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1, 0.7).multiplyScalar(4) });
    const nip = new THREE.Mesh(nipGeo, nipMat);
    nip.position.set(0, 0, zAxis);
    g.add(nip);
    const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.9, 0.5) });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(0, 0, 0.03);
    g.add(halo);
    // A lamp strip on the wall above the printer: dark while idle, blazing once it runs.
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1, 0.7) });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, 4.1, 0.06);
    g.add(lamp);
    const gears = [];
    for (const side of [-1, 1]) {
      const f = new THREE.Mesh(frameGeo, frameMat);
      f.position.set(side * (L / 2 + 0.35) + (side > 0 ? 0.45 : 0), 0, 0);
      g.add(f);
      for (const which of [1, -1]) {
        const gm = new THREE.Mesh(gearGeo, gearMat);
        gm.rotation.y = Math.PI / 2;
        gm.position.set(side * (L / 2 + 1.05), which * (R + gap), zAxis);
        g.add(gm);
        gears.push({ gm, which });
      }
    }
    const webMat = webMaterial(noteCanvas);
    const web = new THREE.Mesh(webGeo, webMat);
    g.add(web);
    machine.add(g);
    return { group: g, x, tOn, rollTop, rollBot, nip, nipMat, halo, haloMat, lamp, lampMat, gears, web, webMat };
  }
  const units = [makeUnit(0, -1e9)];
  PRESS.waveOn.forEach((tOn, i) => {
    units.push(makeUnit((i + 1) * PRESS.spacing, tOn));
    units.push(makeUnit(-(i + 1) * PRESS.spacing, tOn));
  });
  const main = units[0];

  // Fluorescent tubes: an endless ceiling grid over the sea, plus a row on the wall above the printers.
  const tubeGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.6, 8).rotateZ(Math.PI / 2);
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.78, 1, 0.84).multiplyScalar(2.6), fog: true });
  const tubePos = [];
  for (let i = -18; i <= 18; i++) for (let j = 0; j < 20; j++) tubePos.push([i * 7 + (j % 2) * 3.5, 13, 3 + j * 7]);
  for (let x = -120; x <= 120; x += 6) tubePos.push([x, 5.4, 0.35]);
  const tubes = new THREE.InstancedMesh(tubeGeo, tubeMat, tubePos.length);
  const dm = new THREE.Object3D();
  const tubeOn = new Float64Array(tubePos.length);
  const onCol = new THREE.Color();
  tubePos.forEach((p, i) => {
    dm.position.set(...p); dm.updateMatrix(); tubes.setMatrixAt(i, dm.matrix);
    tubes.setColorAt(i, onCol.setRGB(1, 1, 1));
    // The hall is dark except the aisle over the hero printer; each tube fades up when the printer below it starts.
    const k = Math.round(Math.abs(p[0]) / PRESS.spacing);
    const W = PRESS.waveOn;
    tubeOn[i] = k === 0 ? -1e9 : k <= W.length ? W[k - 1] + (p[1] > 10 ? 0.05 + 0.002 * p[2] : 0) : W[W.length - 1] + 0.05 * (k - W.length);
  });
  tubes.frustumCulled = false;
  scene.add(tubes);

  // The sea of paper.
  const seaMap = seaTexture(noteCanvas);
  seaMap.repeat.set(36, 36);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 720),
    new THREE.MeshStandardMaterial({ map: seaMap, roughness: 0.92, metalness: 0, color: 0xc8d6cc, emissive: new THREE.Color(0.2, 0.32, 0.24), emissiveMap: seaMap, emissiveIntensity: 0.34 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -13, 260);
  scene.add(sea);

  // The paper heaps up instead of lying flat. Under each printer, where its sheet pours in, it piles into a long
  // mound; low drifts run between the mounds; loose notes lie on top at every angle. The heap is a displaced sheet over
  // the part of the sea the wide shot sees, printed exactly like the flat sea around it (same carpet, same placement),
  // and it settles to the flat sea at its far edges. Heap and sea rise together.
  const heap = new THREE.Group();
  scene.add(heap);
  const unitXs = [0];
  for (let i = 1; i <= PRESS.waveOn.length; i++) unitXs.push(i * PRESS.spacing, -i * PRESS.spacing);
  const vnoise = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const h = (a, b) => hash1(a * 7919 + b * 104729 + 13);
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    return lerp(lerp(h(xi, zi), h(xi + 1, zi), sx), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), sx), sz);
  };
  const HX = 104, HZ0 = -0.6, HZ1 = 64;
  const heapHeight = (x, z) => {
    let h = 0;
    for (const ux of unitXs) { const dx = (x - ux) / 6.2, dz = (z - 4.2) / 3.6; h += 2.4 * Math.exp(-(dx * dx + dz * dz)); }
    h += 0.75 * vnoise(x * 0.11, z * 0.11) + 0.35 * vnoise(x * 0.27 + 40, z * 0.27 + 40);
    const e = clamp(Math.min((HX - Math.abs(x)) / 18, (HZ1 - z) / 22));
    return 0.06 + h * e * e * (3 - 2 * e);
  };
  {
    const geo = new THREE.PlaneGeometry(2 * HX, HZ1 - HZ0, 350, 110);
    const pos = geo.attributes.position, uv = geo.attributes.uv, cz = (HZ0 + HZ1) / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = cz - pos.getY(i); // laid flat the way the sea is: local +y runs toward -z
      pos.setXYZ(i, x, heapHeight(x, z), z);
      uv.setXY(i, (x + 360) / 720, (620 - z) / 720); // the flat sea's own placement of the carpet
    }
    geo.computeVertexNormals();
    heap.add(new THREE.Mesh(geo, sea.material));
  }
  const loose = new NoteCloud(noteTex, 2600, { emissive: 0.05, sheen: 0.1 });
  loose.material.color.setRGB(0.66, 0.74, 0.68); // the same green-grey as the carpet under them, not white
  loose.setFlutter(0);
  {
    const R = rng(203), up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3();
    const qSlope = new THREE.Quaternion(), qYaw = new THREE.Quaternion(), qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), qTip = new THREE.Quaternion(), eul = new THREE.Euler();
    loose.layout(2600, (i, d) => {
      const x = lerp(-40, HX - 8, R()), z = lerp(0.3, 44, Math.pow(R(), 1.4)), e = 0.25;
      n.set(-(heapHeight(x + e, z) - heapHeight(x - e, z)) / (2 * e), 1, -(heapHeight(x, z + e) - heapHeight(x, z - e)) / (2 * e)).normalize();
      qSlope.setFromUnitVectors(up, n);
      qYaw.setFromAxisAngle(up, R() * Math.PI * 2);
      qTip.setFromEuler(eul.set((R() - 0.5) * 0.7, (R() - 0.5) * 0.3, (R() - 0.5) * 0.7));
      d.quaternion.copy(qSlope).multiply(qYaw).multiply(qFlat).multiply(qTip);
      d.position.set(x, heapHeight(x, z) + 0.04 + Math.pow(R(), 3) * 0.3, z); // some lie on others
      d.scale.setScalar((1.25 + R() * 0.25) / NOTE.W);
    });
  }
  heap.add(loose);
  const heroSpot = new THREE.SpotLight(0xe8fff0, 60, 40, 0.62, 0.7, 1.3);
  heroSpot.position.set(0, 11, 9);
  heroSpot.target.position.set(0, -3, 5);
  scene.add(heroSpot, heroSpot.target);

  const S = {
    scene, machine, units, main, sea, tubes, tubeMat, nipLight, heroSpot, top, rim, amb,
    fx: { bloom: 0.35, threshold: 1.25, bloomRadius: 0.22, grain: 0.05, vignette: 0.55, tint: [0.95, 1.03, 0.97], sat: 0.9 },
    rowsAt, seaLevel,
    update(ctx) {
      const t = ctx.t;
      // Everything here is steady or fades smoothly: no light follows the drums (that would strobe).
      const surge = clamp((t - PRESS.t0) / (PRESS.tEnd - PRESS.t0));
      for (const un of units) {
        const on = t >= un.tOn;
        const D = on ? (rowsAt(t) - (un.tOn > -1e8 ? rowsAt(un.tOn) : 0)) * PRESS.pitch : 0;
        un.rollTop.rotation.x = -D / R;
        un.rollBot.rotation.x = D / R;
        for (const gr of un.gears) gr.gm.rotation.z = gr.which > 0 ? -D / R : D / R + Math.PI / 28;
        // Idle printers are dark; a printer that switches on fades up over a third of a second.
        const f = un.tOn > -1e8 ? smooth(clamp((t - un.tOn) / PRESS.fadeOn)) : 1;
        un.nipMat.color.setRGB(0.55, 1, 0.7).multiplyScalar(lerp(0.02, 2.8 + 1.2 * surge, f));
        un.haloMat.color.setRGB(0.3, 0.9, 0.5).multiplyScalar(lerp(0.015, 0.75, f));
        un.lampMat.color.setRGB(0.55, 1, 0.7).multiplyScalar(lerp(0.03, 2.4, f));
        // The web: the print scrolls with the rollers; a printer that just started pushes its sheet out and down.
        const rows = on ? rowsAt(t) - (un.tOn > -1e8 ? rowsAt(un.tOn) : -1e6) : 0;
        un.webMat.map.offset.y = -(((rows % 1) + 1) % 1);
        // a fresh sheet's free end drops under its own weight, faster than the rollers feed it
        const dtOn = t - un.tOn;
        un.webMat.userData.uLen.value = on ? rows * PRESS.pitch + (un.tOn > -1e8 ? 4.5 * dtOn * dtOn : 0) : -1;
        un.web.visible = on;
        un.webMat.emissiveIntensity = 0.1;
        un.group.visible = true;
      }
      sea.position.y = seaLevel(t);
      sea.visible = true;
      heap.position.y = seaLevel(t); // the heap's heights are measured from the sea's surface
      heap.visible = true;
      machine.visible = true;
      tubes.visible = true;
      nipLight.intensity = 1.2;
      tubeMat.color.setRGB(0.78, 1, 0.84).multiplyScalar(2.4);
      // Tubes fade up (no strike stutter).
      let lit = 0;
      for (let i = 0; i < tubeOn.length; i++) {
        const b = lerp(0.025, 1, smooth(clamp((t - tubeOn[i]) / 0.3)));
        lit += b;
        tubes.setColorAt(i, onCol.setRGB(b, b, b));
      }
      tubes.instanceColor.needsUpdate = true;
      // The hall's overall light follows how many tubes are burning.
      const litFrac = lit / tubeOn.length;
      top.intensity = 1.1 + 2.6 * litFrac;
      heroSpot.intensity = 110;
      rim.intensity = 1.2;
      scene.fog.density = 0.009;
      scene.environmentIntensity = 0.5;
    },
  };
  return S;
}
