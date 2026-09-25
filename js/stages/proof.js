// The proof stage: black space, one block that can't be copied, and the finite grid of 21,000,000.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Block } from '../props/block.js';
import { Grid21, gridEdge, COLS, ROWS } from '../props/grid21.js';
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
    new THREE.PlaneGeometry(2400, 300),
    new THREE.MeshBasicMaterial({ map: textCard('21,000,000', { w: 2048, h: 256, font: '600 190px "Cormorant Garamond"', color: '#ffd9a6' }), transparent: true, depthWrite: false }),
  );
  label.position.set(0, -ROWS / 2 - 320, 0);
  scene.add(label);

  const dust = new Dust({ count: 900, size: 0.016, box: [8, 5, 8], color: [1, 0.7, 0.4], gain: 1.2 });
  scene.add(dust);

  const S = {
    scene, block, ghost, grid, edge, label, dust, key, COLS, ROWS,
    fx: { bloom: 0.9, threshold: 0.75, grain: 0.04, vignette: 0.5, tint: [1.03, 0.98, 0.93] },
    update(ctx) {
      block.visible = true;
      block.position.set(0, 0, 0);
      block.rotation.set(0, 0, 0);
      block.scale.setScalar(1);
      block.setGlow(1);
      ghost.visible = false;
      grid.visible = false;
      edge.visible = false;
      label.visible = false;
      dust.visible = true;
      dust.setTime(ctx.t);
      grid.set(ctx.t);
    },
    // A copy slides out and falls apart.
    ghostAt(k, dir = [1.3, 0, 0]) {
      ghost.visible = k > 0 && k < 1;
      const slide = Math.min(1, k * 2.2);
      ghost.position.set(dir[0] * slide, dir[1] * slide, dir[2] * slide);
      const fail = clamp((k - 0.45) / 0.55);
      ghost.scale.set(1 + fail * 0.25 * hash1(3), 1 - fail * 0.9, 1 + fail * 0.2);
      ghost.rotation.set(fail * 0.5, fail * 0.8, fail * 0.3);
      ghost.material.opacity = (1 - fail) * (0.6 + 0.4 * Math.sin(k * 90));
    },
  };
  return S;
}
