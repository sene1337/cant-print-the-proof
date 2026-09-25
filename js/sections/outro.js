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

  // The moon from verse 1, low behind the pedestal.
  const moonTex = new THREE.Texture(await loadImage(`${TEX.base}tex/moon.jpg`));
  moonTex.colorSpace = THREE.SRGBColorSpace; moonTex.needsUpdate = true;
  const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 96), new THREE.MeshBasicMaterial({ map: moonTex, color: new THREE.Color(1.15, 1.12, 1.05), fog: false }));
  moonTex.center.set(0.5, 0.5);
  moon.position.set(0, 3.4, -40);
  scene.add(moon);
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = hash1(i * 3) * Math.PI - Math.PI / 2, e = hash1(i * 3 + 1) * 0.9 + 0.05, r = 60;
    sp[i * 3] = Math.sin(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = -Math.cos(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.12, color: new THREE.Color(1.4, 1.35, 1.25), fog: false, sizeAttenuation: true }));
  scene.add(stars);

  // The same cowrie that opens verse 1, so the film ends where it began.
  const shell = v1Cowrie({ length: 1.35 }); // lit by this stage's warm studio, not verse 1's cool one
  const coin = new Coin({ radius: 0.62, thickness: 0.1, face: await coinFace('stater'), metal: 'gold', edge: edgeText('CAN’T PRINT THE PROOF'), seed: 31 });
  const noteTex = await banknote({ seed: 5 });
  const noteGeo = new THREE.PlaneGeometry(2.1, 0.9, 24, 6);
  const np = noteGeo.attributes.position;
  for (let i = 0; i < np.count; i++) np.setZ(i, Math.sin(np.getX(i) * 1.1) * 0.08);
  noteGeo.computeVertexNormals();
  const noteMat = new THREE.MeshStandardMaterial({ map: noteTex, side: THREE.DoubleSide, roughness: 0.8 });
  noteMat.customProgramCacheKey = () => 'outro-note-both-sides';
  noteMat.onBeforeCompile = readableBothSides;
  const note = new THREE.Mesh(noteGeo, noteMat);
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
  const ring = new THREE.Points(ringGeo, new THREE.PointsMaterial({ size: 0.03, color: new THREE.Color(1, 0.7, 0.35).multiplyScalar(5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
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
    scene, hero, forms, shell, coin, note, block, chain, ring, card, title, line1, line2, pedestal, lip, top, rim, dust, moon, stars,
    fx: { bloom: 0.45, threshold: 1.0, bloomRadius: 0.4, grain: 0.04, vignette: 0.55 },
    show(i, k = 1) { forms.forEach((f, j) => { f.visible = j === i; }); forms[i].scale.multiplyScalar(k); },
    burst(t, t0) {
      const p = ring.geometry.attributes.position.array;
      const dt = t - t0;
      ring.visible = dt >= 0 && dt < 0.6;
      if (!ring.visible) return;
      for (let i = 0; i < NS; i++) {
        const a = (i / NS) * Math.PI * 2, r = 0.7 + dt * (2.5 + hash1(i) * 2);
        p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = 1.9 + (hash1(i + 3) - 0.5) * 0.3 + dt * 0.3; p[i * 3 + 2] = Math.sin(a) * r;
      }
      ring.geometry.attributes.position.needsUpdate = true;
      ring.material.opacity = clamp(1 - dt / 0.6);
    },
    update(ctx) {
      forms.forEach((f) => { f.visible = false; f.rotation.set(0, 0, 0); });
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
  const tJoin = tProof + 0.9;
  const tCard = 181.4;

  // Anticipation: an empty pedestal in the dark, one light. Then the forms, one per word.
  // Where the camera sits while the forms change; they turn to face it.
  const camAt = (t) => {
    const u = easeInOut(clamp((t - 172.6) / (tI - 172.6)));
    const v = easeInOut(clamp((t - tI) / (tJoin - tI)));
    return {
      pos: [lerp(lerp(0.6, -1.2, u), -0.85, v), lerp(lerp(2.9, 2.55, u), 2.25, v), lerp(lerp(7.5, 4.3, u), 3.05, v)],
      look: [0, lerp(lerp(3.35, 1.8, u), 1.9, v), lerp(-40, 0, u)],
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
      const pop = (t0) => easeOutBack(clamp((t - t0 + 0.06) / 0.28), 2.2);
      s.top.intensity = 18 * clamp((t - 173.6) / 1.4);
      if (t >= tI) {
        let i = 0, t0 = tI;
        if (t >= tGold - 0.05) { i = 1; t0 = tGold - 0.05; }
        if (t >= tPaper - 0.05) { i = 2; t0 = tPaper - 0.05; }
        if (t >= tProof - 0.05) { i = 3; t0 = tProof - 0.05; }
        s.show(i, i === 0 ? clamp((t - tI) / (tShell - tI)) : Math.max(0.01, pop(t0)));
        const p = camAt(t).pos, face = Math.atan2(p[0], p[2]) - s.hero.rotation.y;
        // the shell tilts to show its toothed underside as well as its spotted back
        if (i === 0) s.shell.rotation.set(-0.95 + Math.sin(t * 1.1) * 0.08, face + 0.35 + Math.sin(t * 0.7) * 0.15, 0);
        if (i === 1) s.coin.rotation.set(0, face + 0.45 + (t - t0) * 0.9, 0);
        if (i === 2) s.note.rotation.set(0.12, face + Math.sin(t * 1.3) * 0.22, 0.05);
        if (i === 3) s.block.setGlow(1 + 1.6 * pulse(t - tProof, 2.5));
        for (const tb of [tGold - 0.05, tPaper - 0.05, tProof - 0.05]) s.burst(t, tb);
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
      s.pedestal.visible = false; s.lip.visible = false; s.moon.visible = false;
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
    s.card.visible = true;
    s.card.position.set(0, 20, 0);
    s.title.material.opacity = clamp(c.lt / 0.6);
    s.line1.material.opacity = clamp((c.lt - 0.5) / 0.6);
    s.line2.material.opacity = clamp((c.lt - 0.9) / 0.6);
  }, { hud: 0, bloom: 0.25, threshold: 1.0, shake: 0, vignette: 0.3, grain: 0.03 });
}
