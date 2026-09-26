// VERSE 2 "two percent, like it's rent": a bank note hangs on a line in front of a frosted office window, backlit.
// The shears trim a strip off its edge on every beat, and each strip drops into a tin marked RENT.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { banknote, noteExtras } from '../tex.js';
import { readableBothSides, paperShading } from '../props/notes.js';
import { Dust } from '../props/dust.js';
import { clamp, lerp, hash1, rng, easeIn, easeOut, easeInOut } from '../util.js';
import { clampHot, patch, canvas2d, canvasTex } from '../props/verse2-kit.js';
import { buildShears } from './verse2-coins.js';

export const NW = 2.35, NH = 1.0;
export const NOTE = { x: 0, y: 1.55, z: 0 };
export const STRIP = 0.02 * NW;             // each snip takes exactly two percent of the note
export const TIN = { x: 1.12, z: 0.16, r: 0.37, h: 0.74 };
const G = 8;                                // gravity for the falling strips (paper falls slowly)
const RIGHT = NOTE.x + NW / 2;
export const cutX = (k) => RIGHT - (k + 1) * STRIP;
const CURL = 0.04;   // the hanging note's gentle curl (its edges stand this far forward)

// The window behind: frosted glass lit by fluorescent tubes, in a dark frame.
function windowTexture() {
  const W = 1024, H = 768;
  const [c, g] = canvas2d(W, H);
  const gr = g.createRadialGradient(W * 0.55, H * 0.42, 40, W * 0.5, H * 0.5, W * 0.62);
  gr.addColorStop(0, '#e9fff1'); gr.addColorStop(0.45, '#9fcab4'); gr.addColorStop(1, '#2d4a3f');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // blurred tube shapes behind the frosting
  g.filter = 'blur(18px)';
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (const y of [0.18, 0.5]) g.fillRect(W * 0.1, H * y, W * 0.8, H * 0.035);
  g.filter = 'none';
  // frosting grain
  const R = rng(3);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,20,10'},${R() * 0.06})`; g.fillRect(R() * W, R() * H, 2, 2); }
  // a plain dark frame (no mullion grid: the backdrop should stay quiet)
  g.fillStyle = '#0b100e';
  const f = 30;
  g.fillRect(0, 0, W, f); g.fillRect(0, H - f, W, f); g.fillRect(0, 0, f, H); g.fillRect(W - f, 0, f, H);
  return canvasTex(c);
}

// The tin's paper label, printed once on its front: RENT, and under it the rate, 2%.
// The label is stretched sideways around the tin, so the lettering is drawn condensed.
function labelTexture() {
  const W = 1024, H = 320;
  const [c, g] = canvas2d(W, H);
  g.fillStyle = '#efe6cf'; g.fillRect(0, 0, W, H);
  const R = rng(9);
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(90,70,40,${R() * 0.07})`; g.fillRect(R() * W, R() * H, 3, 1); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const cx = W * 0.25;
  g.fillStyle = '#1d1a16';
  g.font = '900 150px "Playfair Display"';
  g.save(); g.translate(cx, 92); g.scale(0.62, 1); g.fillText('RENT', 0, 0); g.restore();
  g.fillStyle = '#a3261c';
  g.fillRect(cx - 150, 162, 300, 6);
  g.font = '900 140px "Playfair Display"';
  g.save(); g.translate(cx, 244); g.scale(0.62, 1); g.fillText('2%', 0, 0); g.restore();
  return canvasTex(c, { repeat: true });
}

export async function rentStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040807);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 5, 4], size: [5, 1.4], color: [0.88, 1, 0.92], intensity: 2.2 },
    { pos: [5, 2, 4], size: [2.5, 3], color: [0.9, 1, 0.94], intensity: 1.8 },
    { pos: [0.8, 1.6, -5], size: [5, 3.5], color: [0.75, 1, 0.85], intensity: 2.0 },
  ], { top: [0.05, 0.07, 0.06], horizon: [0.02, 0.03, 0.025], bottom: [0.005, 0.006, 0.005] });
  scene.environmentIntensity = 1.0;

  // Fluorescent key from the front and above; the window lights everything from behind.
  const key = new THREE.SpotLight(0xe6fff0, 42, 14, 0.6, 0.6, 2);
  key.position.set(-1.2, 4.2, 3.6);
  key.target.position.set(0.5, 1.4, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const back = new THREE.DirectionalLight(0xd4ffe6, 2.2);
  back.position.set(0.8, 2.4, -4);
  scene.add(back);
  scene.add(new THREE.AmbientLight(0x2a3a32, 0.7));
  // a soft fill from the camera side, so the note's face, the blades and the label read at a glance
  const fill = new THREE.DirectionalLight(0xe8f5ee, 0.9);
  fill.position.set(-2.5, 2.2, 5);
  scene.add(fill);

  // sized and placed so it backlights the note while the strips fall against the dark wall beside it
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.9), new THREE.MeshBasicMaterial({ map: windowTexture() }));
  win.material.color.setScalar(0.8);
  win.position.set(0.85, 2.05, -3.2);
  scene.add(win);
  // an office wall washed by the fluorescent light: brightest behind the note, falling off to the edges
  const wallTex = (() => {
    const [c, g] = canvas2d(512, 256);
    const gr = g.createRadialGradient(270, 120, 10, 256, 128, 300);
    gr.addColorStop(0, '#4b5f55'); gr.addColorStop(0.5, '#27352f'); gr.addColorStop(1, '#0d1411');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    return canvasTex(c);
  })();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: wallTex }));
  wall.position.set(0.9, 2.2, -3.22);
  scene.add(wall);

  // A dark office desk.
  const desk = new THREE.Mesh(new RoundedBoxGeometry(7, 0.08, 3.4, 3, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x55615b, roughness: 0.8, clearcoat: 0.05, clearcoatRoughness: 0.6 }));
  desk.position.set(0.4, -0.04, 0.3);
  desk.receiveShadow = true;
  scene.add(desk);

  // Two clips on threads from above (a horizontal line would cross the shears).
  const steel = clampHot(new THREE.MeshPhysicalMaterial({ color: 0xa8b0b4, metalness: 1, roughness: 0.3 }), 3);
  for (const x of [-0.75, 0.35]) {
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 3, 6), new THREE.MeshStandardMaterial({ color: 0x2a2f2c, roughness: 0.8 }));
    thread.position.set(x, NOTE.y + NH / 2 + 0.1 + 1.5, 0);
    scene.add(thread);
  }
  const clipMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.35, clearcoat: 1 });
  for (const x of [-0.75, 0.35]) {
    const clip = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.12, 0.05, 2, 0.015), clipMat);
    clip.position.set(x, NOTE.y + NH / 2 + 0.02, 0);
    clip.castShadow = true;
    scene.add(clip);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 16, Math.PI), steel);
      arm.position.set(x + s * 0.04, NOTE.y + NH / 2 + 0.08, 0);
      scene.add(arm);
    }
  }

  // The note: backlit by the window, cut back strip by strip.
  const noteTex = await banknote({ seed: 5, serial: 'F 1971 0815 A', res: 2 });
  const cutU = { value: 1 };
  // paper: ink relief, a soft sheen, and light through the sheet from the window behind it
  const noteMat = new THREE.MeshPhysicalMaterial({
    map: noteTex, roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color(0.7, 0.85, 0.75), emissiveMap: noteTex, emissiveIntensity: 0.12,
    normalMap: noteExtras(noteTex).normalMap, normalScale: new THREE.Vector2(0.55, 0.55),
    sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.92, 0.96, 0.92),
  });
  patch(noteMat, 'cutoff', (sh) => {
    sh.uniforms.uCutU = cutU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCutUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCutUv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCutUv; uniform float uCutU;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (vCutUv.x > uCutU) discard;');
  });
  const paperU = { uTranslucency: { value: 0.4 } };
  patch(noteMat, 'paper', (sh) => { readableBothSides(sh); paperShading(sh, paperU); });
  const noteGeo = new THREE.PlaneGeometry(NW, NH, 24, 10);
  {
    const pp = noteGeo.attributes.position;
    for (let i = 0; i < pp.count; i++) pp.setZ(i, CURL * (pp.getX(i) / (NW / 2)) ** 2);
    noteGeo.computeVertexNormals();
  }
  const note = new THREE.Mesh(noteGeo, noteMat);
  note.position.set(NOTE.x, NOTE.y, NOTE.z);
  note.castShadow = true;
  scene.add(note);

  // The strips: four cut on the beats, and a handful already in the tin from earlier months.
  const stripGeo = (u0, u1) => {
    const g = new THREE.PlaneGeometry(STRIP, NH, 1, 6);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) < 0.5 ? u0 : u1);
    return g;
  };
  const stripMat = noteMat.clone();
  stripMat.onBeforeCompile = () => {};
  stripMat.emissiveIntensity = 0.06;
  const strips = [];
  for (let k = 0; k < 4; k++) {
    const u1 = 1 - (k * STRIP) / NW, u0 = 1 - ((k + 1) * STRIP) / NW;
    const m = new THREE.Mesh(stripGeo(u0, u1), stripMat);
    m.castShadow = true;
    scene.add(m);
    strips.push(m);
  }

  // The tin, with its RENT label turned to face the camera.
  const tinMat = clampHot(new THREE.MeshPhysicalMaterial({ color: 0x9aa39f, metalness: 1, roughness: 0.38 }), 3);
  const tin = new THREE.Group();
  tin.position.set(TIN.x, 0, TIN.z);
  const wallGeo = new THREE.CylinderGeometry(TIN.r, TIN.r, TIN.h, 48, 1, true);
  const tinWall = new THREE.Mesh(wallGeo, tinMat);
  tinWall.material.side = THREE.DoubleSide;
  tinWall.position.y = TIN.h / 2;
  tinWall.castShadow = true;
  tin.add(tinWall);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(TIN.r, 48), tinMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.01;
  tin.add(bottom);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(TIN.r, 0.012, 8, 64), tinMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = TIN.h;
  tin.add(lip);
  const labelTex = labelTexture();
  const label = new THREE.Mesh(new THREE.CylinderGeometry(TIN.r + 0.004, TIN.r + 0.004, TIN.h * 0.62, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.85 }));
  label.position.y = TIN.h * 0.5;
  tin.add(label);
  scene.add(tin);

  const shears = buildShears();
  shears.group.scale.setScalar(0.8);
  // against the bright window the polished steel must not flare: cap its highlights in this scene
  shears.group.traverse((o) => { if (o.isMesh) { clampHot(o.material, 1.3); o.material.envMapIntensity = 0.3; } });
  scene.add(shears.group);
  // blades hang down (local x -> world -y). The jaws open in a plane turned 50 degrees about the (vertical) cut line,
  // so from the front one blade crosses in front of the note and the other shows beside its edge, behind it:
  // the scissors read as an X, and the cut stays exactly vertical.
  const th = -50 * Math.PI / 180;
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(Math.sin(th), 0, Math.cos(th)),
    new THREE.Vector3(-Math.cos(th), 0, Math.sin(th)));
  shears.group.quaternion.setFromRotationMatrix(basis);

  const dust = new Dust({ count: 500, size: 0.01, box: [6, 4, 5], color: [0.85, 1, 0.9], gain: 0.6 });
  dust.position.set(0.5, 1.8, 0.5);
  scene.add(dust);

  const S = {
    scene, note, noteMat, strips, tin, label, labelTex, shears, key, back, win, dust,
    fx: { bloom: 0.55, threshold: 0.95, bloomRadius: 0.5, grain: 0.05, vignette: 0.55, tint: [0.96, 1.03, 0.99] },

    // Turn the label so a RENT faces a camera at (camX, camZ). Cylinder u runs from +z (u = 0) toward +x (u = 0.25);
    // the words are centred at u = 0.25 and 0.75 of the texture.
    faceLabel(camX, camZ) {
      const a = Math.atan2(camX - TIN.x, camZ - TIN.z);
      labelTex.offset.x = 0.25 - a / (Math.PI * 2);
    },

    // cuts: song times the blades close; t0: when the shears arrive.
    trimAt(t, cuts, t0) {
      let done = 0;
      for (const c of cuts) if (t >= c) done++;
      cutU.value = 1 - (done * STRIP) / NW;
      // the note jolts on each cut and swings a little on its clips
      let jolt = 0;
      for (const c of cuts) if (t >= c) jolt += Math.exp(-(t - c) * 5) * Math.sin((t - c) * 16);
      note.rotation.set(0.02 * jolt, 0.05 * Math.sin(t * 0.9), 0.006 * jolt);
      // the shears: close on each beat, reopen, and step one strip to the left between cuts
      let close = 0;
      for (const c of cuts) {
        const a = t - c;
        if (a > -0.12 && a <= 0) close = Math.max(close, easeIn(1 + a / 0.12, 2));
        else if (a > 0 && a < 0.32) close = Math.max(close, a < 0.06 ? 1 : 1 - easeOut((a - 0.06) / 0.26, 2));
      }
      const open = (1 - close) * 20 * Math.PI / 180;
      shears.upper.rotation.z = open;
      shears.lower.rotation.z = -open;
      let x = cutX(0);
      cuts.forEach((c, k) => { if (k < cuts.length - 1) x -= STRIP * easeInOut(clamp((t - c - 0.2) / 0.25)); });
      const arrive = 1 - easeOut(clamp((t - t0) / 0.4), 2.5);
      shears.group.position.set(x + arrive * 0.9, NOTE.y + NH / 2 + 0.14 + arrive * 0.5, arrive * 0.6);
      // the strips fall into the tin and lean there
      strips.forEach((m, k) => {
        const c = cuts[k];
        m.visible = c !== undefined && t >= c;
        if (!m.visible) return;
        const a = t - c;
        const x0 = cutX(k) + STRIP / 2 - (k > 0 ? 0 : 0);
        const endY = 0.02 + NH / 2, y0 = NOTE.y;
        const tf = Math.sqrt((2 * (y0 - endY)) / G);
        const h = (q) => hash1(k * 31 + q);
        const tx = TIN.x + (h(1) - 0.5) * 0.14, tz = TIN.z + (h(2) - 0.5) * 0.12;
        if (a < tf) {
          // it peels away from the blade, bowing outward as it drops, tipping and twisting, then drops into the tin
          const u = a / tf;
          const bow = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.42 + h(6) * 0.12);
          m.position.set(lerp(x0, tx, easeInOut(u)) + bow, y0 - 0.5 * G * a * a, lerp(CURL * (x0 / (NW / 2)) ** 2, tz, u) + bow * 0.25);
          m.rotation.set(Math.sin(a * 11 + k) * 0.2 * u, -0.35 + a * (1.2 + h(3)), -bow * 1.1);
        } else {
          const b = a - tf;
          const lean = (0.3 + h(4) * 0.25) * (h(5) < 0.5 ? -1 : 1) * easeOut(clamp(b / 0.25), 2);
          m.position.set(tx, endY + Math.abs(Math.sin(b * 22)) * 0.03 * Math.exp(-b * 10), tz);
          m.rotation.set(lean * 0.4, -0.35 + tf * (1.2 + h(3)), lean);
        }
      });
    },

    update(ctx) {
      cutU.value = 1;
      note.rotation.set(0, 0, 0);
      strips.forEach((m) => { m.visible = false; });
      shears.upper.rotation.z = 0.35;
      shears.lower.rotation.z = -0.35;
      shears.group.position.set(cutX(0), NOTE.y + NH / 2 + 0.16, 0);
      key.intensity = 42;
      dust.visible = true;
      dust.setTime(ctx.t, [0.01, 0.03, 0]);
    },
  };
  return S;
}
