// The proof stage: black space and one block of bronze, cut with its hash and lit from inside the cuts.
// A printer tries to copy it: the copy comes out as a paper box with the same print, and it can't stand up.
// Each chorus shows the block mined at the very frame the word "proof" is sung; the last chorus shows the chain.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Block, link } from '../props/block.js';
import { Dust } from '../props/dust.js';
import { blockFacePaper } from '../tex.js';
import { clamp, hash1, fmtInt, easeOut } from '../util.js';

function paperBox(tex) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 10, 10, 10);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.userData.orig = Float32Array.from(geo.attributes.position.array);
  return m;
}

// Crumple: k = 0 whole, 1 collapsed into a flat, creased heap. Pure function of k.
function crumple(m, k) {
  const pos = m.geometry.attributes.position, o = m.userData.orig;
  const f = Math.pow(clamp(k), 1.3);
  for (let i = 0; i < pos.count; i++) {
    const x = o[i * 3], y = o[i * 3 + 1], z = o[i * 3 + 2];
    const q = Math.round((x + 0.5) * 20) * 441 + Math.round((y + 0.5) * 20) * 21 + Math.round((z + 0.5) * 20);
    const n1 = hash1(q * 3 + 1) - 0.5, n2 = hash1(q * 3 + 2) - 0.5, n3 = hash1(q * 3 + 3) - 0.5;
    const sag = 1 - 0.86 * f;
    const ny = -0.5 + (y + 0.5) * sag;
    pos.setXYZ(i, x * (1 + 0.28 * f) + n1 * 0.22 * f, ny + n2 * 0.12 * f, z * (1 + 0.24 * f) + n3 * 0.22 * f);
  }
  pos.needsUpdate = true;
  m.geometry.computeVertexNormals();
}

export async function proofStage(film) {
  const chain = film.chain, T = film.T;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.035);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [5, 1.4], color: [1, 0.78, 0.55], intensity: 2.6 },
    { pos: [-6, 0.5, 1.5], size: [0.5, 5], color: [1, 0.62, 0.3], intensity: 3.2 },
    { pos: [5, 1, -3], size: [0.5, 5], color: [0.9, 0.92, 1], intensity: 1.8 },
    { pos: [0, -1, 6], size: [4, 0.4], color: [1, 0.7, 0.4], intensity: 1.2 },
  ], { top: [0.3, 0.22, 0.16], horizon: [0.06, 0.04, 0.03], bottom: [0.01, 0.008, 0.006] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xffd6a8, 30, 20, 0.55, 0.8, 1.5);
  key.position.set(-2.5, 4.5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff9a4a, 1.6);
  rim.position.set(3, 1.5, -4);
  scene.add(rim);

  // A dark floor so the block and the paper have somewhere to stand.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.6, envMapIntensity: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  const tProof = [30, 84, 154].map((t) => T.wordAfter('proof.', t).s);
  const heroInfo = tProof.map((t) => chain.block(chain.frameAt(t)));
  const heroes = heroInfo.map((b) => new Block({ hash: b.hash, height: '#' + fmtInt(b.i), nonce: b.nonce, style: 'engraved' }));
  heroes.slice(0, 2).forEach((h) => scene.add(h));
  const block = heroes[0];

  // The chain for the last chorus: the block for "proof" at its head, older blocks behind it.
  const chainGroup = new THREE.Group();
  const chainBlocks = [];
  const head = heroInfo[2].i;
  for (let i = 0; i < 14; i++) {
    const b = chain.block(head - i * 37);
    const blk = i === 0 ? heroes[2] : new Block({ hash: b.hash, height: '#' + fmtInt(b.i), nonce: b.nonce, style: 'engraved' });
    blk.position.set(-i * 1.9, 0, 0);
    chainGroup.add(blk);
    chainBlocks.push(blk);
    if (i > 0) {
      const l = link(0.9, 0.08);
      l.material = new THREE.MeshStandardMaterial({ color: 0x2a1d14, metalness: 0.9, roughness: 0.35, emissive: new THREE.Color(1, 0.45, 0.1), emissiveIntensity: 0.6 });
      l.rotation.y = Math.PI / 2;
      l.position.set(-i * 1.9 + 0.95, 0, 0);
      chainGroup.add(l);
    }
  }
  scene.add(chainGroup);

  // Paper copies: same print, no work inside.
  const papers = heroInfo.map((b) => paperBox(blockFacePaper({ hash: b.hash, height: '#' + fmtInt(b.i), nonce: b.nonce })));
  papers.push(paperBox(papers[1].material.map));
  papers.forEach((p) => scene.add(p));

  const dust = new Dust({ count: 700, size: 0.012, box: [8, 5, 8], color: [1, 0.7, 0.4], gain: 0.9 });
  scene.add(dust);

  return {
    scene, block, heroes, chainGroup, chainBlocks, papers, dust, key, rim, floor,
    fx: { bloom: 0.55, threshold: 1.0, bloomRadius: 0.4, grain: 0.04, vignette: 0.5, tint: [1.03, 0.98, 0.93] },
    update(ctx) {
      heroes.forEach((h) => { h.visible = false; h.position.set(0, 0, 0); h.rotation.set(0, 0, 0); h.scale.setScalar(1); h.setGlow(1); });
      heroes[2].visible = true; // lives inside the chain group
      chainGroup.visible = false;
      chainGroup.position.set(0, 0, 0);
      chainGroup.rotation.set(0, 0, 0);
      chainBlocks.forEach((b, i) => { if (i > 0) { b.visible = true; b.setGlow(1); } });
      heroes[2].position.set(0, 0, 0);
      papers.forEach((p) => { p.visible = false; p.position.set(0, 0, 0); p.rotation.set(0, 0, 0); p.scale.setScalar(1); });
      floor.visible = true;
      dust.visible = true;
      dust.setTime(ctx.t);
      key.position.set(-2.5, 4.5, 3); key.target.position.set(0, 0, 0); key.intensity = 30;
      rim.intensity = 1.6;
    },
    // Show chorus n's block (1 or 2). Chorus 3's block is the head of the chain.
    hero(n) { const h = heroes[n - 1]; h.visible = true; return h; },
    // A printed copy slides out beside the block and collapses. k: 0..1 over the attempt.
    paperAt(which, k, from = [0, 0, 0], dir = [1.35, 0, 0], spin = 0) {
      const p = papers[which];
      p.visible = k > 0;
      if (!p.visible) return;
      const slide = easeOut(Math.min(1, k * 2.4), 2);
      const fail = clamp((k - 0.42) / 0.58);
      crumple(p, fail);
      p.position.set(from[0] + dir[0] * slide, from[1] + dir[1] * slide, from[2] + dir[2] * slide);
      p.rotation.set(fail * 0.12, spin * slide + fail * 0.25, fail * 0.18 * Math.sign(dir[0] || 1));
    },
  };
}
