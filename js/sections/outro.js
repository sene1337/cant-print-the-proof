// OUTRO 172.60-184.03 s. Owner: director.
// "I was a shell. I was gold. I was paper. Now I'm proof." One object on one pedestal, changing form on each word.
// Then it takes its place at the head of the chain, and the film ends on where to verify it.
import * as THREE from 'three';
import { studioEnv, orbitCam, moveCam } from '../film.js';
import { Coin } from '../props/coin.js';
import { Block, link } from '../props/block.js';
import { Dust } from '../props/dust.js';
import { cowrie as v1Cowrie } from '../props/verse1-cowrie.js';
import { readableBothSides } from '../props/notes.js';
import { coinFace, edgeText, banknote, textCard, loadImage, TEX } from '../tex.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, pulse, range, hash1 } from '../util.js';

export const SITE_URL = 'sene1337.github.io/cant-print-the-proof';

function cowrieTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#f3ead8'); grd.addColorStop(0.45, '#e8d6b4'); grd.addColorStop(1, '#f6efe2');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 520; i++) {
    const x = hash1(i * 3) * 1024, y = 60 + hash1(i * 3 + 1) * 250, r = 3 + hash1(i * 3 + 2) * 11;
    g.fillStyle = `rgba(${150 + hash1(i) * 50},${95 + hash1(i + 9) * 40},${45 + hash1(i + 4) * 30},${0.35 + hash1(i + 7) * 0.4})`;
    g.beginPath(); g.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(120,80,40,0.25)';
  g.fillRect(0, 150, 1024, 22); g.fillRect(0, 230, 1024, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cowrie() {
  const geo = new THREE.SphereGeometry(1, 96, 64);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 1.0; y *= 0.58; z *= 0.7;
    if (y < -0.2) y = -0.2 + (y + 0.2) * 0.25;
    // the toothed slit along the underside
    if (y < -0.18 && Math.abs(z) < 0.08) y += 0.05 * (1 + Math.sin(x * 38)) * (1 - Math.abs(x));
    // a gentle hump towards the back
    y += 0.06 * Math.exp(-((x + 0.25) ** 2) * 4) * Math.max(0, y) * 3;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ map: cowrieTexture(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.2 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

async function turntable(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.03);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 1], size: [5, 2], color: [1, 0.9, 0.78], intensity: 2.2 },
    { pos: [-6, 1, 2], size: [0.5, 5], color: [1, 0.8, 0.6], intensity: 2.6 },
    { pos: [6, 1, -1], size: [0.4, 5], color: [1, 0.9, 0.8], intensity: 2.0 },
  ], { top: [0.4, 0.34, 0.28], horizon: [0.08, 0.06, 0.04], bottom: [0.005, 0.004, 0.003] });

  const top = new THREE.SpotLight(0xffe0b8, 18, 20, 0.26, 0.8, 1.5);
  top.position.set(0, 7, 1.5);
  top.target.position.set(0, 1, 0);
  top.castShadow = true;
  top.shadow.mapSize.set(1024, 1024);
  scene.add(top, top.target);
  const rim = new THREE.DirectionalLight(0xffb070, 1.6);
  rim.position.set(-3, 2, -4);
  scene.add(rim);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.6, 0.9, 96),
    [
      new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
      new THREE.MeshPhysicalMaterial({ color: 0x010101, roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.4 }),
      new THREE.MeshPhysicalMaterial({ color: 0x010101, roughness: 0.3 }),
    ],
  );
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.018, 12, 160), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(1, 0.72, 0.3), metalness: 1, roughness: 0.25 }));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.9;
  scene.add(lip);
  pedestal.position.y = 0.45;
  pedestal.receiveShadow = true;
  scene.add(pedestal);

  const hero = new THREE.Group();
  hero.position.set(0, 1.9, 0);
  scene.add(hero);

  // The moon from verse 1, low on the horizon behind the pedestal. It stands beyond the sea's far edge (the sea is a
  // disc of radius 150), so the horizon hides its lower part as the real horizon would. (Nearer, the sea's surface
  // cut across it in front of the horizon, and the moon seemed to sit in the water.)
  const MOON_R = 28.4, MOON_Y = 7.9, MOON_Z = -185, HORIZON_Y = -0.45; // the horizon's height at the moon, seen from this shot's camera
  const moonTex = new THREE.Texture(await loadImage(`${TEX.base}tex/moon.jpg`));
  moonTex.colorSpace = THREE.SRGBColorSpace; moonTex.anisotropy = 8; moonTex.needsUpdate = true;
  const moon = new THREE.Mesh(new THREE.CircleGeometry(MOON_R, 128), new THREE.MeshBasicMaterial({ map: moonTex, color: new THREE.Color(1.15, 1.12, 1.05), fog: false }));
  moonTex.center.set(0.5, 0.5);
  // The photo's disc ends just inside its square (at 0.992 of the half-width): fit the disc to the circle, so no dark
  // ring of the photo's black sky shows round the moon's edge.
  moonTex.repeat.set(0.986, 0.986);
  moon.position.set(0, MOON_Y, MOON_Z);
  scene.add(moon);
  // Keep the moon sharp. It is far past the focus, so the shot's depth of field blurred it by about 4 px at 1080p:
  // that does not show on a small moon, but it made this big one look low-resolution. A stand-in for the part of the
  // moon above the horizon draws only into the blur's depth pass (in the picture it writes nothing).
  // It is pulled toward the lens to the focus distance, so it covers exactly the moon's pixels and marks them as in
  // focus. Everything else keeps its blur.
  const a0 = Math.asin((HORIZON_Y - MOON_Y) / MOON_R); // where the horizon cuts the disc
  const above = new THREE.Shape();
  above.absarc(0, 0, MOON_R, a0, Math.PI - a0, false);
  above.closePath();
  const moonFocus = new THREE.Mesh(new THREE.ShapeGeometry(above, 64), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  moonFocus.frustumCulled = false;
  const lens = new THREE.Vector3(), moonView = new THREE.Vector3(), toLens = new THREE.Matrix4(), shrink = new THREE.Matrix4(), back = new THREE.Matrix4();
  moonFocus.onBeforeRender = (r, sc, camera) => {
    lens.setFromMatrixPosition(camera.matrixWorld);
    moonView.setFromMatrixPosition(moon.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    const k = Math.min(1, film.bokeh.uniforms.focus.value / Math.max(1e-3, -moonView.z));
    // scale about the lens: every point keeps its place on screen and moves to the focus distance
    toLens.makeTranslation(-lens.x, -lens.y, -lens.z); shrink.makeScale(k, k, k); back.makeTranslation(lens.x, lens.y, lens.z);
    moonFocus.matrixWorld.copy(moon.matrixWorld).premultiply(toLens).premultiply(shrink).premultiply(back);
  };
  moon.add(moonFocus);
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = hash1(i * 3) * Math.PI - Math.PI / 2, e = hash1(i * 3 + 1) * 0.9 + 0.05, r = 60;
    sp[i * 3] = Math.sin(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = -Math.cos(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.12, color: new THREE.Color(1.4, 1.35, 1.25), fog: false, sizeAttenuation: true }));
  scene.add(stars);

  // A moonlit sea, the bookend to verse 1's opening: a night sky, dark water the pedestal stands in,
  // and the moon's broken path of light across the water.
  const HORIZON = new THREE.Color(0.03, 0.045, 0.09);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(vec3(${HORIZON.r}, ${HORIZON.g}, ${HORIZON.b}), vec3(0.003, 0.005, 0.014), smoothstep(0.0, 0.45, d.y));
        c += vec3(0.05, 0.06, 0.08) * pow(max(0.0, dot(d, normalize(vec3(0.0, 0.043, -1.0)))), 12.0); // haze round the moon
        gl_FragColor = vec4(d.y < 0.0 ? vec3(${HORIZON.r}, ${HORIZON.g}, ${HORIZON.b}) * 0.6 : c, 1.0);
      }`,
  }));
  scene.add(sky);
  // dark night water: no studio reflections in it (they read as a grey-brown floor)
  const sea = new THREE.Mesh(new THREE.CircleGeometry(150, 96), new THREE.MeshStandardMaterial({ color: 0x020409, roughness: 0.4, metalness: 0, envMapIntensity: 0.0 }));
  sea.rotation.x = -Math.PI / 2;
  sea.receiveShadow = true;
  scene.add(sea);
  // The moon's glade: short streaks of light scattered along the moon's path, from under the moon at the horizon to
  // the pedestal. The path widens with distance (so it keeps about the same width on screen), and the streaks brighten
  // toward the horizon. (Canvas top = the far end.) The texture runs along the path as the square of the distance, so
  // the near water, which fills most of the frame, gets most of its detail.
  const gc = document.createElement('canvas');
  gc.width = 256; gc.height = 2048;
  {
    const g = gc.getContext('2d');
    for (let i = 0; i < 2600; i++) {
      const v = hash1(i * 3 + 1), y = v * 2048;
      const x = 128 + (hash1(i * 3) + hash1(i * 7 + 5) - 1) * 118; // denser along the middle of the path
      const w = (4 + hash1(i * 5) * 14) * (1 + 0.8 * v), a = (0.3 + 0.7 * (1 - v)) * (1 - Math.abs(x - 128) / 128);
      g.fillStyle = `rgba(215,228,255,${Math.max(0, a).toFixed(3)})`;
      g.fillRect(x - w / 2, y, w, 1.5 + hash1(i * 11) * 1.5);
    }
  }
  const gladeTex = new THREE.CanvasTexture(gc);
  gladeTex.colorSpace = THREE.SRGBColorSpace; gladeTex.anisotropy = 8;
  const GLADE_NEAR = 2, GLADE_FAR = -150, gladeGeo = new THREE.PlaneGeometry(1, 1, 1, 96);
  {
    const pos = gladeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = (pos.getY(i) + 0.5) ** 2; // 0 at the near end, 1 at the horizon
      pos.setX(i, pos.getX(i) * 2 * lerp(0.7, 13.5, k));
      pos.setY(i, lerp(-GLADE_NEAR, -GLADE_FAR, k)); // local +y becomes world -z once laid flat
    }
  }
  const glade = new THREE.Mesh(gladeGeo, new THREE.MeshBasicMaterial({ map: gladeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: new THREE.Color(0.9, 0.95, 1.1) }));
  glade.rotation.x = -Math.PI / 2;
  glade.position.set(0, 0.012, 0);
  glade.frustumCulled = false;
  scene.add(glade);
  scene.fog.color.copy(HORIZON);

  // The same cowrie that opens verse 1, so the film ends where it began.
  const shell = v1Cowrie({ length: 1.35 }); // lit by this stage's warm studio, not verse 1's cool one
  const coin = new Coin({ radius: 0.62, thickness: 0.1, face: await coinFace('stater'), metal: 'gold', edge: edgeText('CAN’T PRINT THE PROOF'), seed: 31 });
  const noteTex = await banknote({ seed: 5 });
  const noteMat = new THREE.MeshStandardMaterial({ map: noteTex, side: THREE.DoubleSide, roughness: 0.8 });
  noteMat.customProgramCacheKey = () => 'outro-note-both-sides';
  noteMat.onBeforeCompile = readableBothSides;
  // The note in two halves hinged on its centre line, so on "Now I'm proof" it can fold shut like a book.
  const note = new THREE.Group();
  const halves = [0, 1].map((side) => {
    const g = new THREE.PlaneGeometry(1.05, 0.9, 12, 6);
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, uv.getX(i) * 0.5 + side * 0.5);
      const x = pos.getX(i) + (side ? 0.525 : -0.525);
      pos.setX(i, x); pos.setZ(i, Math.sin(x * 1.1) * 0.08);
    }
    g.computeVertexNormals();
    const hinge = new THREE.Group();
    hinge.add(new THREE.Mesh(g, noteMat));
    note.add(hinge);
    return hinge;
  });
  const last = film.chain.block(film.chain.n - 1);
  const block = new Block({ hash: last.hash, height: '#' + last.i.toLocaleString('en-US'), nonce: last.nonce, style: 'engraved' });
  block.scale.setScalar(0.95);
  // Shell and note turn to face the camera whatever the turntable is doing: yaw first, then tilt.
  shell.rotation.order = 'YXZ';
  note.rotation.order = 'YXZ';
  const forms = [shell, coin, note, block];
  forms.forEach((f) => hero.add(f));

  // The chain it joins: older blocks receding behind it.
  const chain = new THREE.Group();
  for (let i = 1; i <= 24; i++) {
    const b = film.chain.block(film.chain.n - 1 - i * 23);
    const k = new Block({ hash: b.hash, height: '#' + b.i.toLocaleString('en-US'), nonce: b.nonce, style: 'engraved' });
    k.scale.setScalar(0.95);
    k.position.set(0, 0, -i * 1.8);
    chain.add(k);
    const l = link(0.85, 0.06);
    l.position.set(0, 0, -i * 1.8 + 0.9);
    chain.add(l);
  }
  chain.position.copy(hero.position);
  scene.add(chain);

  // Spark ring on each change of form.
  const NS = 260;
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  // Round, soft sparks (plain points draw as squares, which read as grey tiles once they fade near the lens).
  const dot = document.createElement('canvas');
  dot.width = dot.height = 64;
  { const g = dot.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); }
  const ring = new THREE.Points(ringGeo, new THREE.PointsMaterial({ size: 0.035, map: new THREE.CanvasTexture(dot), color: new THREE.Color(1, 0.7, 0.35).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.frustumCulled = false;
  scene.add(ring);

  // End card: title and where to verify, on black.
  const card = new THREE.Group();
  const title = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.05),
    new THREE.MeshBasicMaterial({ map: textCard('CAN’T PRINT THE PROOF', { w: 2048, h: 300, font: '600 180px "Cormorant Garamond"', color: '#f1c77a' }), transparent: true, depthWrite: false }));
  title.position.set(0, 0.75, 0);
  const line1 = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 0.6),
    new THREE.MeshBasicMaterial({ map: textCard('Every frame of this film is a mined block.', { w: 2048, h: 170, font: '500 92px "Figtree"', color: '#efe7d8' }), transparent: true, depthWrite: false }));
  line1.position.set(0, -0.25, 0);
  const line2 = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 0.6),
    new THREE.MeshBasicMaterial({ map: textCard(SITE_URL, { w: 2048, h: 170, font: '600 92px "JetBrains Mono"', color: '#f7931a' }), transparent: true, depthWrite: false }));
  line2.position.set(0, -0.95, 0);
  card.add(title, line1, line2);
  for (const m of [title, line1, line2]) { m.material.fog = false; m.material.toneMapped = false; }
  scene.add(card);

  const dust = new Dust({ count: 500, size: 0.012, box: [8, 5, 8], color: [1, 0.8, 0.55], gain: 0.8 });
  scene.add(dust);

  return {
    scene, hero, forms, shell, coin, note, halves, block, sky, sea, glade, chain, ring, card, title, line1, line2, pedestal, lip, top, rim, dust, moon, stars,
    fx: { bloom: 0.45, threshold: 1.0, bloomRadius: 0.4, grain: 0.04, vignette: 0.55 },
    show(i, k = 1) { forms.forEach((f, j) => { f.visible = j === i; }); forms[i].scale.multiplyScalar(k); },
    burst(t, t0) {
      const p = ring.geometry.attributes.position.array;
      const dt = t - t0;
      ring.visible = dt >= 0 && dt < 0.6;
      if (!ring.visible) return;
      for (let i = 0; i < NS; i++) {
        const a = (i / NS) * Math.PI * 2, r = 0.7 + dt * (1.1 + hash1(i) * 0.9); // stays well clear of the lens
        p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = 1.9 + (hash1(i + 3) - 0.5) * 0.3 + dt * 0.3; p[i * 3 + 2] = Math.sin(a) * r;
      }
      ring.geometry.attributes.position.needsUpdate = true;
      ring.material.opacity = clamp(1 - dt / 0.6);
    },
    update(ctx) {
      forms.forEach((f) => { f.visible = false; f.rotation.set(0, 0, 0); });
      halves.forEach((h) => { h.rotation.set(0, 0, 0); h.scale.setScalar(1); });
      sky.visible = true; sea.visible = true; glade.visible = true;
      shell.scale.setScalar(1.35);
      moon.visible = true; stars.visible = true; coin.scale.setScalar(1); note.scale.setScalar(1); block.scale.setScalar(0.95);
      block.setGlow(1);
      hero.position.set(0, 1.9, 0);
      hero.rotation.set(0, ctx.t * 0.5, 0);
      chain.visible = false;
      ring.visible = false;
      card.visible = false;
      pedestal.visible = true; lip.visible = true;
      top.intensity = 18;
      dust.visible = true;
      dust.setTime(ctx.t);
    },
  };
}

export const stages = { 'outro-turntable': turntable };

export function shots(S, T) {
  const w = (word) => T.wordAfter(word, 175).s;
  const tI = w('i'), tShell = w('shell.'), tGold = w('gold.'), tPaper = w('paper.'), tNow = w('now'), tProof = w('proof.');
  const tJoin = tProof + 0.7;
  const tCard = 180.9; // leaves the address on screen for over two seconds

  // Anticipation: an empty pedestal in the dark, one light. Then the forms, one per word.
  // Where the camera sits while the forms change; they turn to face it.
  const camAt = (t) => {
    const u = easeInOut(clamp((t - 172.6) / (tI - 172.6)));
    const v = easeInOut(clamp((t - tI) / (tJoin - tI)));
    return {
      pos: [lerp(lerp(0.6, -1.2, u), -0.85, v), lerp(lerp(2.9, 2.55, u), 2.25, v), lerp(lerp(7.5, 4.3, u), 3.05, v)],
      look: [0, lerp(lerp(4.14, 1.8, u), 1.9, v), lerp(-40, 0, u)], // starts on the moon's centre
      fov: lerp(16, 30, u),
    };
  };
  S(172.6, 'outro-turntable', (c, cam) => {
    // Night again. Start on the moon, then pull back to find the pedestal in front of it; then ease in on the forms.
    const k = camAt(c.t);
    cam.position.set(...k.pos);
    cam.lookAt(...k.look);
    cam.fov = k.fov;
  },
    (s, c) => {
      const t = c.t;
      s.top.intensity = 18 * clamp((t - 173.6) / 1.4);
      if (t >= tI) {
        // Each form hands over to the next: the old one shrinks away as the new one grows out of it.
        // On "Now" the note folds shut like a book, and on "proof" the block grows out of the fold.
        const tG = tGold - 0.05, tP = tPaper - 0.05, tB = tProof - 0.3;
        // the old form is gone before the new one grows, under the burst of sparks: they never pass through each other
        const grow = (t0) => easeOutBack(clamp((t - t0 - 0.07) / 0.3), 1.5);
        const shrink = (t1) => 1 - easeIn(clamp((t - t1 + 0.1) / 0.16), 2);
        const p = camAt(t).pos, face = Math.atan2(p[0], p[2]) - s.hero.rotation.y;
        if (t < tG + 0.07) {
          s.shell.visible = true;
          s.shell.scale.setScalar(1.35 * clamp((t - tI) / (tShell - tI)) * shrink(tG));
          // it tilts to show its toothed underside as well as its spotted back
          s.shell.rotation.set(-0.95 + Math.sin(t * 1.1) * 0.08, face + 0.35 + Math.sin(t * 0.7) * 0.15, 0);
        }
        if (t >= tG + 0.07 && t < tP + 0.07) {
          s.coin.visible = true;
          s.coin.scale.setScalar(Math.max(0.01, grow(tG) * shrink(tP)));
          s.coin.rotation.set(0, face + 0.45 + (t - tG) * 0.9, 0);
        }
        if (t >= tP + 0.07 && t < tProof + 0.12) {
          s.note.visible = true;
          const fold = easeInOut(clamp((t - tNow) / (tB + 0.25 - tNow)));
          s.note.scale.setScalar(Math.max(0.01, grow(tP) * (1 - easeIn(clamp((t - tProof + 0.12) / 0.24), 2))));
          s.note.rotation.set(0.12 * (1 - fold), face + Math.sin(t * 1.3) * 0.22 * (1 - fold), 0.05 * (1 - fold));
          s.halves[0].rotation.y = 1.3 * fold; s.halves[1].rotation.y = -1.3 * fold;
        }
        if (t >= tB) {
          s.block.visible = true;
          s.block.scale.setScalar(0.95 * easeOutBack(clamp((t - tB) / 0.4), 1.3));
          s.block.setGlow(1 + 1.6 * pulse(t - tProof, 2.5));
        }
        for (const tb of [tG, tP, tProof - 0.05]) s.burst(t, tb);
      }
    },
    {
      fadeIn: 0.8, aperture: 0.00012, focus: 4.2, maxblur: 0.006,
    });
  // Joins the chain: the camera pulls up and back; older blocks recede behind it.
  S(tJoin, 'outro-turntable', moveCam({ from: [3.2, 2.6, 4.4], to: [5.5, 5.5, 8.5], look: [0, 1.9, -1], look2: [0, 1.6, -9], fov: 34, ease: easeInOut }),
    (s, c) => {
      s.show(3);
      s.hero.rotation.set(0, 0.35, 0);
      s.block.setGlow(1.2);
      s.chain.visible = true;
      s.chain.children.forEach((k, i) => { k.visible = c.lt > i * 0.05; });
      s.pedestal.visible = false; s.lip.visible = false; s.moon.visible = false; s.glade.visible = false;
      s.top.intensity = 4;
    }, { bloom: 0.3, threshold: 1.1, fadeOut: 0.5 });
  // End card.
  S(tCard, 'outro-turntable', (c, cam) => {
    // Fit the 6-unit-wide card to the frame width on narrow (vertical) frames.
    const fit = Math.max(1, (16 / 9) / c.aspect * 0.62);
    cam.position.set(0, 20.0, 9.4 * fit);
    cam.lookAt(0, 20.0, 0);
    cam.fov = 36;
  }, (s, c) => {
    s.forms.forEach((f) => { f.visible = false; });
    s.pedestal.visible = false; s.lip.visible = false; s.dust.visible = false; s.moon.visible = false; s.stars.visible = false;
    s.sky.visible = false; s.sea.visible = false; s.glade.visible = false; // the end card sits on black
    s.card.visible = true;
    s.card.position.set(0, 20, 0);
    s.title.material.opacity = clamp(c.lt / 0.45);
    s.line1.material.opacity = clamp((c.lt - 0.25) / 0.45);
    s.line2.material.opacity = clamp((c.lt - 0.45) / 0.45);
  }, { hud: 0, bloom: 0.25, threshold: 1.0, shake: 0, vignette: 0.3, grain: 0.03 });
}
