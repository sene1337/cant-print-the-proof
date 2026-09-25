// The proof stage: black space, one block that can't be copied, and the finite grid of 21,000,000.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Block, link } from '../props/block.js';
import { Grid21, gridEdge, COLS, ROWS, WIDTH, HEIGHT, lightPos } from '../props/grid21.js';
import { Dust } from '../props/dust.js';
import { textCard } from '../tex.js';
import { clamp, hash1 } from '../util.js';

export async function proofStage(film) {
  const chain = film.chain;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 1.5], color: [1, 0.7, 0.4], intensity: 3 },
    { pos: [-6, 0, 1], size: [0.6, 5], color: [1, 0.6, 0.25], intensity: 4 },
    { pos: [5, 1, -3], size: [0.6, 5], color: [0.9, 0.9, 1], intensity: 2 },
  ]);
  scene.environmentIntensity = 0.8;

  const key = new THREE.SpotLight(0xffd0a0, 40, 20, 0.6, 0.7, 1.5);
  key.position.set(-2, 4, 3);
  scene.add(key, key.target);

  const b0 = chain.block(0);
  const block = new Block({ hash: b0.hash, height: '#0', nonce: b0.nonce, label: 'FRAME BLOCK' });
  scene.add(block);

  // The failed copy: a hollow wireframe twin that can't hold together.
  const ghost = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1, 3, 3, 3)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(1, 0.2, 0.15).multiplyScalar(2.5), transparent: true, opacity: 1 }),
  );
  scene.add(ghost);

  const grid = new Grid21();
  scene.add(grid);
  const edge = gridEdge();
  scene.add(edge);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(3200, 400),
    new THREE.MeshBasicMaterial({ map: textCard('21,000,000', { w: 2048, h: 256, font: '600 200px "Cormorant Garamond"', color: '#ffd9a6' }), transparent: true, depthWrite: false }),
  );
  label.position.set(0, -HEIGHT / 2 - 420, 0);
  scene.add(label);

  // A short chain of real frame blocks, for the last chorus.
  const chainGroup = new THREE.Group();
  const chainBlocks = [];
  for (let i = 0; i < 14; i++) {
    const b = chain.block(5000 - i * 37);
    const blk = new Block({ hash: b.hash, height: '#' + b.i.toLocaleString('en-US'), nonce: b.nonce, label: 'FRAME BLOCK' });
    blk.position.set(-i * 1.9, 0, 0);
    chainGroup.add(blk);
    chainBlocks.push(blk);
    if (i > 0) { const l = link(0.9, 0.07); l.rotation.y = Math.PI / 2; l.position.set(-i * 1.9 + 0.95, 0, 0); chainGroup.add(l); }
  }
  scene.add(chainGroup);

  const ghost2 = ghost.clone();
  ghost2.material = ghost.material.clone();
  scene.add(ghost2);

  const dust = new Dust({ count: 900, size: 0.016, box: [8, 5, 8], color: [1, 0.7, 0.4], gain: 1.2 });
  scene.add(dust);

  const S = {
    scene, block, ghost, ghost2, grid, edge, label, chainGroup, chainBlocks, dust, key, COLS, ROWS, WIDTH, HEIGHT, lightPos,
    fx: { bloom: 0.9, threshold: 0.75, grain: 0.04, vignette: 0.5, tint: [1.03, 0.98, 0.93] },
    update(ctx) {
      block.visible = true;
      block.position.set(0, 0, 0);
      block.rotation.set(0, 0, 0);
      block.scale.setScalar(1);
      block.setGlow(1);
      ghost.visible = false;
      ghost2.visible = false;
      chainGroup.visible = false;
      grid.visible = false;
      edge.visible = false;
      label.visible = false;
      dust.visible = true;
      dust.setTime(ctx.t);
      grid.set(ctx.t);
    },
    // A copy slides out of the block and falls apart. which = 1 or 2 (two ghosts can fail at once).
    ghostAt(k, dir = [1.3, 0, 0], which = 1, origin = [0, 0, 0]) {
      const g = which === 2 ? ghost2 : ghost;
      g.visible = k > 0 && k < 1;
      const slide = Math.min(1, k * 2.2);
      g.position.set(origin[0] + dir[0] * slide, origin[1] + dir[1] * slide, origin[2] + dir[2] * slide);
      const fail = clamp((k - 0.45) / 0.55);
      g.scale.set(1 + fail * 0.25 * hash1(3), 1 - fail * 0.9, 1 + fail * 0.2);
      g.rotation.set(fail * 0.5, fail * 0.8, fail * 0.3);
      g.material.opacity = (1 - fail) * (0.6 + 0.4 * Math.sin(k * 90));
    },
  };
  return S;
}
