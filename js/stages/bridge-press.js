// The money printer (instrumental break, 102.26-109.73): two giant chrome rollers bolted to an endless wall,
// a green slot of light behind them, and a jet of bank notes that shoots out faster and faster into a rising sea
// of paper under rows of fluorescent tubes. Everything is a pure function of song time.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { NoteCloud } from '../props/notes.js';
import { normalFromHeight } from '../tex.js';
import { bridgeNote } from '../props/bridge-note.js';
import { clamp, hash1, lerp, rng } from '../util.js';

export const PRESS = {
  t0: 102.26,       // the break starts
  tEnd: 109.73,     // the drop
  R: 1.4,           // roller radius
  L: 10,            // roller length (along x)
  zAxis: 1.6,       // roller axes stand this far in front of the wall
  pitch: 0.5,       // paper travel per printed row
  r0: 5,            // rows per second when the break starts
  c: 2.9,           // acceleration of the row rate (rows/s^2 / 2)
  spacing: 13.5,    // distance between printers along the wall
  // The drum fill before the drop (onsets measured from the master): each hit switches on the next pair of printers.
  waveOn: [108.333, 108.667, 108.967, 109.133, 109.3, 109.467, 109.633],
};

// Rows printed since t0 (negative before). Rate is r0 before t0, then rises linearly.
export function rowsAt(t) {
  const tau = t - PRESS.t0;
  return tau < 0 ? PRESS.r0 * tau : PRESS.r0 * tau + PRESS.c * tau * tau;
}
function rowTime(k) {
  if (k < 0) return PRESS.t0 + k / PRESS.r0;
  const { r0, c } = PRESS;
  return PRESS.t0 + (-r0 + Math.sqrt(r0 * r0 + 4 * c * k)) / (2 * c);
}
function rateAt(t) {
  const tau = t - PRESS.t0;
  return tau < 0 ? PRESS.r0 : PRESS.r0 + 2 * PRESS.c * tau;
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
function plateTextures(note) {
  const W = 1024, H = 512;
  const col = canvas(W, H), g = col.getContext('2d');
  const hc = canvas(W, H), h = hc.getContext('2d');
  g.fillStyle = '#c9cfcb'; g.fillRect(0, 0, W, H);
  h.fillStyle = '#ffffff'; h.fillRect(0, 0, W, H);
  const rows = 16, lanes = 8;
  const cw = W / rows, ch = H / lanes;
  const gA = grayNote(note, 1.6), gB = grayNote(note, 2.2);
  for (let r = 0; r < rows; r++) {
    for (let l = 0; l < lanes; l++) {
      const x = r * cw, y = l * ch;
      for (const [ctx, src, alpha] of [[g, gA, 0.55], [h, gB, 1]]) {
        ctx.save();
        ctx.translate(x + cw / 2, y + ch / 2);
        ctx.rotate(Math.PI / 2);
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(src, -ch * 0.46, -cw * 0.44, ch * 0.92, cw * 0.88);
        ctx.restore();
      }
      // the plate border groove
      g.strokeStyle = 'rgba(30,36,33,0.7)'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
      h.strokeStyle = '#000'; h.lineWidth = 2; h.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
    }
  }
  const map = texOf(col, { repeat: true });
  const normal = normalFromHeight(hc, 1.2, 1);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
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
  g.fillStyle = '#1f2a23'; g.fillRect(0, 0, S, S);
  const nw = 150, nh = nw / 2.35;
  for (let i = 0; i < 1500; i++) {
    const x = R() * S, y = R() * S, a = R() * Math.PI * 2, shade = 0.55 + R() * 0.45;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const px = x + ox, py = y + oy;
        if (px < -nw || px > S + nw || py < -nw || py > S + nw) continue;
        g.save();
        g.translate(px, py); g.rotate(a);
        g.fillStyle = 'rgba(0,0,0,0.45)';
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
    color: new THREE.Color(0.86, 0.9, 0.88), metalness: 1, roughness: 0.28,
    map: plate.map, normalMap: plate.normal, normalScale: new THREE.Vector2(0.45, 0.45),
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
    machine.add(g);
    return { group: g, x, tOn, rollTop, rollBot, nip, nipMat, halo, haloMat, gears };
  }
  const units = [makeUnit(0, -1e9)];
  PRESS.waveOn.forEach((tOn, i) => {
    units.push(makeUnit((i + 1) * PRESS.spacing, tOn));
    units.push(makeUnit(-(i + 1) * PRESS.spacing, tOn));
  });
  const main = units[0];

  // Fluorescent tubes: an endless ceiling grid over the sea, plus a row on the wall above the printers.
  const tubeGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.6, 8).rotateZ(Math.PI / 2);
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
    // The hall is dark except the aisle over the hero printer; each tube lights when the printer below it starts.
    const k = Math.round(Math.abs(p[0]) / PRESS.spacing);
    const W = PRESS.waveOn;
    tubeOn[i] = k === 0 ? -1e9 : k <= W.length ? W[k - 1] + (p[1] > 10 ? 0.04 + 0.002 * p[2] : 0) : W[W.length - 1] + 0.03 * (k - W.length);
  });
  tubes.frustumCulled = false;
  scene.add(tubes);

  // The sea of paper.
  const seaMap = seaTexture(noteCanvas);
  seaMap.repeat.set(36, 36);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 720),
    new THREE.MeshStandardMaterial({ map: seaMap, roughness: 0.92, metalness: 0, color: 0xa9b8ae, emissive: new THREE.Color(0.2, 0.32, 0.24), emissiveMap: seaMap, emissiveIntensity: 0.18 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -13, 260);
  scene.add(sea);
  const heroSpot = new THREE.SpotLight(0xe8fff0, 60, 40, 0.62, 0.7, 1.3);
  heroSpot.position.set(0, 11, 9);
  heroSpot.target.position.set(0, -3, 5);
  scene.add(heroSpot, heroSpot.target);

  // The notes.
  const cloud = new NoteCloud(noteTex, 6400, { emissive: 0.12 });
  scene.add(cloud);

  const G = 9.8, VT = 5.5, KD = 0.55;
  const S = {
    scene, machine, units, main, cloud, sea, tubes, tubeMat, nipLight, heroSpot, top, rim, amb,
    fx: { bloom: 0.35, threshold: 1.25, bloomRadius: 0.22, grain: 0.05, vignette: 0.55, tint: [0.95, 1.03, 0.97], sat: 0.9 },
    rowsAt, seaLevel, rateAt,
    // Lay out every running printer's jet of notes for time t. lanes/scale shape the hero printer's jet,
    // otherLanes/otherScale the rest; others: false shows the hero printer alone.
    jet(t, { lanes = 8, maxAge = 4.2, scale = 0.44, spread = 1, speed = 1, others = true, otherLanes = 5, otherScale = 0.5 } = {}) {
      cloud.visible = true;
      cloud.setTime(t);
      cloud.setFlutter(1);
      const sl = seaLevel(t);
      const kMax = Math.floor(rowsAt(t));
      const kLo = Math.floor(rowsAt(t - maxAge)) + 1;
      const spans = [];
      let total = 0;
      for (let ui = 0; ui < units.length; ui++) {
        const un = units[ui];
        if (ui > 0 && (!others || t < un.tOn)) continue;
        const kMin = ui === 0 ? kLo : Math.max(kLo, Math.ceil(rowsAt(un.tOn)));
        const ln = ui === 0 ? lanes : otherLanes;
        const n = Math.max(0, kMax - kMin + 1) * ln;
        spans.push({ un, ui, kMin, ln, sc: ui === 0 ? scale : otherScale, start: total, n });
        total += n;
      }
      let sp = 0;
      cloud.layout(total, (n, d) => {
        while (n >= spans[sp].start + spans[sp].n) sp++;
        const s0 = spans[sp];
        const m = n - s0.start;
        const k = s0.kMin + Math.floor(m / s0.ln), j = m % s0.ln;
        const tk = rowTime(k);
        const a = t - tk;
        if (a < 0) return false;
        const id = ((k + 100000) * 16 + s0.ui) * 16 + j;
        const h1 = hash1(id * 7 + 1), h2 = hash1(id * 7 + 2), h3 = hash1(id * 7 + 3), h4 = hash1(id * 7 + 4), h5 = hash1(id * 7 + 5), h6 = hash1(id * 7 + 6);
        const u = (2.5 + 0.42 * rateAt(tk)) * speed * (0.8 + 0.4 * h1);
        const vz = u, vy = u * (0.06 + 0.16 * (h2 - 0.35)) * spread, vx = u * 0.1 * (h3 - 0.5) * spread;
        const ez = (1 - Math.exp(-KD * a)) / KD;
        const eg = Math.exp(-G * a / VT);
        const x0 = s0.un.x - L / 2 + ((j + 0.5 + 0.55 * (h4 - 0.5)) / s0.ln) * L;
        const sway = Math.min(1, a * 1.5);
        const x = x0 + vx * ez + Math.sin(a * (2.2 + 2.5 * h5) + h6 * 6.28) * 0.45 * sway * spread;
        const y = -VT * a + (vy + VT) * (VT / G) * (1 - eg);
        const z = zAxis + 0.2 + vz * ez + Math.cos(a * (1.7 + 2 * h6) + h5 * 6.28) * 0.25 * sway;
        if (y < sl - 0.3) return false;
        d.position.set(x, y, z);
        const tum = Math.min(1, a * 0.9);
        d.rotation.set(-Math.PI / 2 + tum * a * (h1 - 0.5) * 9, tum * a * (h2 - 0.5) * 5, tum * a * (h3 - 0.5) * 7);
        d.scale.setScalar(s0.sc * (0.9 + 0.2 * h5));
      });
    },
    update(ctx) {
      const t = ctx.t;
      const low = ctx.T.env('low', t), high = ctx.T.env('high', t);
      const surge = clamp((t - PRESS.t0) / (PRESS.tEnd - PRESS.t0));
      for (const un of units) {
        const on = t >= un.tOn;
        const D = on ? (rowsAt(t) - (un.tOn > -1e8 ? rowsAt(un.tOn) : 0)) * PRESS.pitch : 0;
        un.rollTop.rotation.x = -D / R;
        un.rollBot.rotation.x = D / R;
        for (const gr of un.gears) gr.gm.rotation.z = gr.which > 0 ? -D / R : D / R + Math.PI / 28;
        // Idle printers are dark; a printer that switches on flares, then runs hot with the bass.
        const flare = on && un.tOn > -1e8 ? Math.exp(-(t - un.tOn) * 5) * 4 : 0;
        const k = on ? 2.5 + 2 * surge + 2.5 * low + flare : 0.02;
        un.nipMat.color.setRGB(0.55, 1, 0.7).multiplyScalar(k);
        un.haloMat.color.setRGB(0.3, 0.9, 0.5).multiplyScalar(on ? 0.5 + 0.6 * low + flare * 0.3 : 0.015);
        un.group.visible = true;
      }
      sea.position.y = seaLevel(t);
      sea.visible = true;
      machine.visible = true;
      tubes.visible = true;
      cloud.visible = false;
      nipLight.intensity = 0.7 + 1.0 * low;
      tubeMat.color.setRGB(0.78, 1, 0.84).multiplyScalar(2.3 + 0.5 * high);
      // Tubes: off, a stutter when they strike, then on.
      let lit = 0;
      for (let i = 0; i < tubeOn.length; i++) {
        const dt = t - tubeOn[i];
        let b = 0.025;
        if (dt >= 0) { b = dt < 0.14 ? (hash1(i * 31 + Math.floor(dt * 60)) > 0.45 ? 1 : 0.15) : 1; lit++; }
        tubes.setColorAt(i, onCol.setRGB(b, b, b));
      }
      tubes.instanceColor.needsUpdate = true;
      // The hall's overall light follows how many tubes are burning.
      const litFrac = lit / tubeOn.length;
      top.intensity = 0.35 + 2.4 * litFrac;
      heroSpot.intensity = 60;
      rim.intensity = 1.2;
      scene.fog.density = 0.012;
      scene.environmentIntensity = 0.5;
    },
  };
  return S;
}
