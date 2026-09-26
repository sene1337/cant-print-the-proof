// The house of cards (106.37-112.23): in a single shaft of light on dark stone, printed notes are stacked into a
// tower, one tier on each hit; on the drum fill the last note is laid on top and creeps toward the edge; when the
// music stops the whole house of cards collapses in slow motion, and the last note flutters down onto the ruins.
// Flash safety: big notes, slow tumbles, no strobing (checked with tools/flash.py).
import * as THREE from 'three';
import { NoteCloud } from '../props/notes.js';
import { normalFromHeight } from '../tex.js';
import { bridgeNote, readableBothSides } from '../props/bridge-note.js';
import { clamp, hash1, lerp, rng, smooth, easeOut } from '../util.js';

// House of cards: notes (scale 0.8: 1.88 x 0.8) stand on their short edge in steep tents; a flat note bridges each
// pair of tents and carries a tent of the next tier.
export const HOC = { scale: 0.8, lean: (11 * Math.PI) / 180, tiers: 4, spacing: 1.0 };
HOC.h = 2.35 * HOC.scale;                          // card height
HOC.ridge = HOC.h * Math.cos(HOC.lean);            // tent height
HOC.foot = HOC.h * Math.sin(HOC.lean);             // half the tent's footprint depth
HOC.tier = HOC.ridge + 0.012;                      // one tier, including the flat note
HOC.top = (HOC.tiers - 1) * HOC.tier + HOC.ridge;  // the apex ridge
export const DROP = { t0: 109.73, tLand: 111.93, beamH: 26, beamR: 2.75, crownY: HOC.top + 0.012, land: [2.55, 0.03, 0.75] };
// Hits measured from the master. The tiers land on the beat (tier 0 already stands when the shot opens); the last note
// is laid on the apex on the second hit of the drum fill.
export const BUILD = { tiers: [-1e9, 107.0, 107.667, 108.0], cap: 108.667, drop: 6.5, dur: 0.38 };
// The drum fill: every hit shakes the tower; after the last note is laid, each hit nudges it toward the edge.
export const FILL = [108.333, 108.667, 108.967, 109.133, 109.3, 109.467, 109.633];
const CREEP_HITS = FILL.filter((h) => h > BUILD.cap + 0.1);
const CREEP = 0.12; // how far each hit nudges the top note toward the edge
// The collapse: slow-motion gravity (units/s^2) so the tumbles stay slow.
export const FALL = { t0: 109.73, g: 5.5 };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Dark stone slabs with fine seams (colour + height for a normal map).
function slabTextures() {
  const S = 1024, col = canvas(S, S), g = col.getContext('2d'), hc = canvas(S, S), h = hc.getContext('2d');
  const R = rng(5);
  g.fillStyle = '#56524c'; g.fillRect(0, 0, S, S);
  h.fillStyle = '#909090'; h.fillRect(0, 0, S, S);
  for (let i = 0; i < 14000; i++) {
    const x = R() * S, y = R() * S, r = 0.6 + R() * R() * 7, v = R();
    g.fillStyle = v < 0.5 ? `rgba(30,28,25,${R() * 0.1})` : `rgba(150,142,130,${R() * 0.06})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    h.fillStyle = `rgba(${v < 0.5 ? 60 : 200},${v < 0.5 ? 60 : 200},${v < 0.5 ? 60 : 200},${R() * 0.15})`;
    h.beginPath(); h.arc(x, y, r, 0, Math.PI * 2); h.fill();
  }
  // seams: two slabs across
  g.strokeStyle = 'rgba(15,13,11,0.9)'; h.strokeStyle = '#000'; g.lineWidth = h.lineWidth = 4;
  for (const c of [g, h]) {
    c.beginPath(); c.moveTo(0, 2); c.lineTo(S, 2); c.moveTo(2, 0); c.lineTo(2, S);
    c.moveTo(S / 2, 0); c.lineTo(S / 2, S); c.stroke();
  }
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  const normal = normalFromHeight(hc, 1.5, 1);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  return { map, normal };
}

// A soft shaft of light: brightest where the eye looks through the most air, fading toward the floor.
function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.96, 0.86) }, uGain: { value: 0.5 }, uH: { value: DROP.beamH } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uGain, uH;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float h = (vY / uH) + 0.5;           // 0 at the floor, 1 at the lamp
        float fall = smoothstep(0.0, 0.12, h) * (0.62 + 0.38 * h);
        gl_FragColor = vec4(uColor * f * fall * uGain, 1.0);
      }`,
  });
}

function sprite() {
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// The top note: it rests on the apex, creeps toward the edge on each hit of the fill, then (falling-leaf motion) tips
// off, drifts forward clear of the tower, rocks gently and settles on the stone in front of it.
export function notePose(t) {
  const { t0, tLand, crownY, land } = DROP;
  if (t < BUILD.cap - BUILD.dur) return { hidden: true, x: 0.1, y: crownY + BUILD.drop, z: 0, roll: 0, pitch: 0, yaw: 0, u: 0 };
  if (t < t0) {
    let creep = 0;
    for (const h of CREEP_HITS) if (t >= h) creep += CREEP * easeOut(clamp((t - h) / 0.12), 2);
    const arrive = BUILD.drop * (1 - easeOut(clamp((t - (BUILD.cap - BUILD.dur)) / BUILD.dur), 2.5));
    return { x: 0.1 + creep, y: crownY + arrive, z: 0, roll: 0, pitch: 0, yaw: 0, u: 0 };
  }
  const x0 = 0.1 + CREEP * CREEP_HITS.length;
  const u = clamp((t - t0) / (tLand - t0));
  const tl = Math.min(t, tLand) - t0;
  const ph = tl * ((Math.PI * 2) / 1.3);
  const damp = Math.min(1, u * 5) * (1 - smooth(clamp((u - 0.78) / 0.22)));
  const fall = u * u * (3 - 2 * u);
  const y = t >= tLand ? land[1] : lerp(crownY, land[1], fall) + Math.cos(2 * ph) * 0.06 * damp;
  // it drifts out to the right of the tower quickly, so it falls against the dark, not in front of the paper
  const x = lerp(x0, land[0], easeOut(u, 3)) + Math.sin(ph) * 0.28 * damp;
  const z = lerp(0, land[2], easeOut(u, 2.2));
  const tip = -0.55 * Math.sin(Math.PI * clamp(u / 0.22)); // it tips over the edge, then levels out
  const roll = tip - Math.cos(ph) * 0.3 * damp;
  const pitch = Math.sin(ph * 0.5 + 0.4) * 0.14 * damp;
  const yaw = tl * 0.35;
  const slide = t > tLand ? (1 - Math.exp(-(t - tLand) * 6)) * 0.1 : 0;
  return { x: x + slide, y, z, roll: t >= tLand ? 0 : roll, pitch: t >= tLand ? 0 : pitch, yaw, u };
}

// The tower sways a hair on each hit of the fill (a few pixels at most: no flicker).
export function towerTremble(t) {
  let r = 0;
  for (let i = 0; i < FILL.length; i++) {
    const a = t - FILL[i];
    if (a < 0 || a > 0.8) continue;
    r += Math.exp(-a * 7) * Math.sin(a * 22) * 0.0035;
  }
  return r;
}

export async function dropStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const lamp = new THREE.SpotLight(0xfff1dc, 34, 60, 0.108, 0.45, 0.7);
  lamp.position.set(0, DROP.beamH, 0);
  lamp.target.position.set(0, 0, 0);
  scene.add(lamp, lamp.target);
  const amb = new THREE.AmbientLight(0x1a1712, 0.35);
  scene.add(amb);
  // A warm key from the front so the faces of the standing notes read (the top lamp only grazes them).
  const key = new THREE.SpotLight(0xffe6c4, 0, 40, 0.42, 0.6, 1.1);
  key.position.set(4.5, 9, 12);
  key.target.position.set(0, 3.4, 0);
  scene.add(key, key.target);

  const slab = slabTextures();
  slab.map.repeat.set(6, 6); slab.normal.repeat.set(6, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: slab.map, normalMap: slab.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.55, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, DROP.beamR, DROP.beamH, 64, 1, true), beamMaterial());
  beam.position.y = DROP.beamH / 2;
  scene.add(beam);

  // Dust turning in the beam.
  const ND = 700;
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.035, map: sprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    color: new THREE.Color(1, 0.93, 0.8).multiplyScalar(1.4),
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // The note: a gently curled sheet.
  const tex = await bridgeNote();
  const geo = new THREE.PlaneGeometry(2.35, 1.0, 32, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, 0.1 * (x / 1.175) ** 2 + 0.03 * Math.sin(y * 2.5 + x));
  }
  geo.computeVertexNormals();
  const noteMat = readableBothSides(new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 }), 'drop');
  const note = new THREE.Mesh(geo, noteMat);
  note.rotation.x = -Math.PI / 2;
  const noteRoll = new THREE.Group(); noteRoll.add(note);
  const noteYaw = new THREE.Group(); noteYaw.add(noteRoll);
  noteYaw.scale.setScalar(0.8);
  scene.add(noteYaw);

  // The house of cards: tents of two leaning notes, a flat note bridging each pair of tents, four tiers.
  const hocGroup = new THREE.Group();
  scene.add(hocGroup);
  const hoc = new NoteCloud(tex, 32, { emissive: 0.1, rough: 0.8 }); // a little self-light: no note turns black
  hoc.setFlutter(0);
  hocGroup.add(hoc);
  const cards = [];
  {
    const { tiers, spacing, tier } = HOC;
    let rank = 0;
    for (let k = 0; k < tiers; k++) {
      const n = tiers - k, y0 = k * tier;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * spacing;
        for (const s of [1, -1]) cards.push({ kind: 'stand', k, s, x, y0, id: cards.length, rank: rank++ });
      }
      if (k < tiers - 1) for (let j = 0; j < n - 1; j++) cards.push({ kind: 'flat', k, x: ((j + 0.5) - (n - 1) / 2) * spacing, y0, id: cards.length, rank: rank++ });
    }
  }
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  // Pose one card at time t (into the layout dummy). Returns false while it is not in the scene yet.
  function cardPose(c, t, d) {
    const { h, foot, ridge, lean } = HOC;
    const arr = BUILD.tiers[c.k];
    if (t < arr - BUILD.dur) return false;
    const lift = BUILD.drop * (1 - easeOut(clamp((t - (arr - BUILD.dur)) / BUILD.dur), 2.5));
    const h1 = hash1(c.id * 7 + 1), h2 = hash1(c.id * 7 + 2), h3 = hash1(c.id * 7 + 3), h4 = hash1(c.id * 7 + 4), h5 = hash1(c.id * 7 + 5);
    const ts = FALL.t0 + 0.03 * c.k + 0.08 * h1;
    const a = Math.max(0, t - ts);
    const y1 = 0.004 + 0.011 * c.rank;                 // where it comes to rest on the pile
    if (c.kind === 'stand') {
      // The note stands on its bottom edge (the pivot). In the collapse the pivot drops and slides out while the note
      // tips over outward and ends lying flat.
      const g = FALL.g, fallH = Math.max(0, c.y0 - y1);
      const Tf = fallH > 0 ? Math.sqrt((2 * fallH) / g) : 0;
      const yP = Math.max(y1, c.y0 - 0.5 * g * a * a);
      const e = easeOut(clamp(a / Math.max(Tf, 0.8)), 2);
      const dx = (c.x === 0 ? h4 - 0.5 : Math.sign(c.x)) * (0.1 + 0.35 * h4) + (h5 - 0.5) * 0.4;
      const dz = c.s * (0.25 + 0.5 * h2 + 0.15 * c.k);
      // upper notes start tipping as soon as their support goes, and have finished tipping by the time they land
      const Tr = Math.max(0.8 * Tf, 0.75 + 0.2 * h3);
      const r = a > 0 ? Math.pow(clamp(a / Tr), 1.4) : 0;
      const phi = lerp(-c.s * lean, c.s * (Math.PI / 2 - 0.04), r);
      const yaw = (h3 - 0.5) * 0.6 * r;
      const px = c.x + dx * e, py = yP + lift, pz = c.s * foot + dz * e;
      const half = h / 2;
      d.position.set(px + Math.sin(yaw) * Math.sin(phi) * half, py + Math.cos(phi) * half, pz + Math.cos(yaw) * Math.sin(phi) * half);
      qa.setFromAxisAngle(AY, yaw); qb.setFromAxisAngle(AX, phi); qc.setFromAxisAngle(AZ, Math.PI / 2);
      d.quaternion.copy(qa).multiply(qb).multiply(qc);
    } else {
      // A flat note on two ridges: when they go it drops, banking a little, and lands flat on the pile.
      const yc0 = c.y0 + ridge + 0.006;
      const g = FALL.g, fallH = Math.max(0, yc0 - y1);
      const Tf = Math.sqrt((2 * fallH) / g);
      const yc = Math.max(y1, yc0 - 0.5 * g * a * a);
      const e = clamp(a / Tf);
      const bank = Math.sin(Math.PI * e);
      d.position.set(c.x + (h4 - 0.5) * 0.8 * easeOut(e, 2), yc + lift, (h5 - 0.5) * 1.4 * easeOut(e, 2));
      qa.setFromAxisAngle(AY, (h2 - 0.5) * 0.9 * e);
      qb.setFromAxisAngle(AZ, (h3 - 0.5) * 0.7 * bank);
      qc.setFromAxisAngle(AX, -Math.PI / 2 + (h1 - 0.5) * 0.5 * bank);
      d.quaternion.copy(qa).multiply(qb).multiply(qc);
    }
    d.scale.setScalar(HOC.scale);
    return true;
  }
  const layoutHoc = (t) => hoc.layout(cards.length, (i, d) => cardPose(cards[i], t, d));

  // Soft contact shadow under the note (a hard shadow read as a black wedge).
  const blobTex = (() => {
    const c = canvas(128, 128), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0 }));
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);

  const S = {
    scene, lamp, key, beam, dust, floor, note, noteYaw, noteRoll, blob, hoc, hocGroup, cards,
    fx: { bloom: 0.35, threshold: 1.15, bloomRadius: 0.4, grain: 0.06, vignette: 0.6, tint: [1.02, 1.0, 0.96], sat: 0.85, shake: 0.0015 },
    notePose,
    update(ctx) {
      const t = ctx.t;
      hocGroup.visible = true;
      hocGroup.rotation.set(0, 0, t < FALL.t0 ? towerTremble(t) : 0);
      layoutHoc(t);
      key.intensity = 28;
      const q = notePose(t);
      noteYaw.visible = !q.hidden;
      noteYaw.position.set(q.x, q.y, q.z);
      noteYaw.rotation.set(0, q.yaw, 0);
      noteRoll.rotation.set(q.pitch, 0, q.roll);
      const near = clamp(1 - q.y / 2.2);
      blob.position.set(q.x, 0.004, q.z);
      blob.rotation.z = -q.yaw;
      blob.scale.set(2.2 * (1.25 - 0.35 * near), 1.1 * (1.25 - 0.35 * near), 1);
      blob.material.opacity = 0.55 * near * near;
      // Dust: slow orbits inside the cone.
      const a = dust.geometry.attributes.position.array;
      for (let i = 0; i < ND; i++) {
        const h = hash1(i * 3 + 1);
        const y = ((h * DROP.beamH * 0.95 - t * (0.05 + 0.08 * hash1(i * 3 + 7))) % (DROP.beamH * 0.95) + DROP.beamH * 0.95) % (DROP.beamH * 0.95);
        const rMax = lerp(DROP.beamR, 0.25, y / DROP.beamH) * 0.92;
        const r = Math.sqrt(hash1(i * 3 + 2)) * rMax;
        const ang = hash1(i * 3 + 3) * Math.PI * 2 + t * (0.1 + 0.2 * hash1(i * 3 + 5));
        a[i * 3] = Math.cos(ang) * r;
        a[i * 3 + 1] = y + 0.05;
        a[i * 3 + 2] = Math.sin(ang) * r;
      }
      dust.geometry.attributes.position.needsUpdate = true;
      lamp.intensity = 24;
      beam.material.uniforms.uGain.value = 0.3;
    },
  };
  return S;
}
