// The gold stage: a black studio, one coin, hard light. Used for the intro, the minting, and the clipping.
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { Dust } from '../props/dust.js';
import { coinFace, edgeText } from '../tex.js';
import { clamp, hash1 } from '../util.js';

export async function goldStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.05);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 1.5], size: [6, 2.5], color: [1, 0.9, 0.78], intensity: 2.2 },
    { pos: [-6, 1.2, 2], size: [0.5, 5], color: [1, 0.82, 0.62], intensity: 3.0 },
    { pos: [6, 0.8, -1], size: [0.4, 5], color: [1, 0.92, 0.8], intensity: 2.4 },
    { pos: [0, 0.4, -6], size: [7, 0.3], color: [1, 0.62, 0.3], intensity: 2.0 },
  ], { top: [0.55, 0.47, 0.38], horizon: [0.12, 0.09, 0.06], bottom: [0.01, 0.008, 0.006] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xffe2b0, 9, 30, 0.6, 1.0, 1.5);
  key.position.set(-3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb86b, 2.5);
  rim.position.set(3, 2, -5);
  scene.add(rim);

  const face = await coinFace('stater');
  const blank = await coinFace('stater', { blank: true });
  const coin = new Coin({ radius: 1, thickness: 0.16, face, metal: 'gold', edge: edgeText("CAN'T PRINT THE PROOF"), seed: 11 });
  scene.add(coin);

  // A struck blank for the minting shots.
  const blankCoin = new Coin({ radius: 1, thickness: 0.16, face: blank, metal: 'gold', seed: 12 });
  blankCoin.visible = false;
  scene.add(blankCoin);

  // Floor: black lacquer, for reflections under the coin.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x0b0907, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The die that strikes the king's face into the gold.
  const die = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.05, 2.4, 96, 1),
    new THREE.MeshPhysicalMaterial({ color: 0x9aa0a6, metalness: 1, roughness: 0.32 }),
  );
  die.castShadow = true;
  scene.add(die);

  // Sparks from a strike.
  const NS = 400;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    size: 0.035, color: new THREE.Color(1, 0.6, 0.2).multiplyScalar(6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sparks.frustumCulled = false;
  scene.add(sparks);

  // A blade for clipping.
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.03, 0.9),
    new THREE.MeshPhysicalMaterial({ color: 0xc9ced4, metalness: 1, roughness: 0.12 }),
  );
  scene.add(blade);

  const dust = new Dust({ count: 500, size: 0.009, box: [9, 6, 9], gain: 0.7 });
  scene.add(dust);

  const S = {
    scene, coin, blankCoin, floor, die, sparks, blade, dust, key, rim,
    fx: { bloom: 0.32, threshold: 1.1, bloomRadius: 0.35, grain: 0.04, vignette: 0.5, tint: [1.02, 0.98, 0.92] },
    burst(t, t0, origin = [0, 0.1, 0], power = 1) {
      const p = sparks.geometry.attributes.position.array;
      const dt = t - t0;
      sparks.visible = dt >= 0 && dt < 0.9;
      if (!sparks.visible) return;
      for (let i = 0; i < NS; i++) {
        const a = hash1(i * 3) * Math.PI * 2, e = hash1(i * 3 + 1) * 0.9 + 0.1, v = (1.5 + hash1(i * 3 + 2) * 4) * power;
        p[i * 3] = origin[0] + Math.cos(a) * Math.cos(e) * v * dt;
        p[i * 3 + 1] = origin[1] + Math.sin(e) * v * dt - 4.9 * dt * dt;
        p[i * 3 + 2] = origin[2] + Math.sin(a) * Math.cos(e) * v * dt;
      }
      sparks.geometry.attributes.position.needsUpdate = true;
      sparks.material.opacity = clamp(1 - dt / 0.9);
    },
    update(ctx) {
      // Defaults; shots override what they need.
      coin.visible = true;
      coin.position.set(0, 1.2, 0);
      coin.rotation.set(0, 0, 0);
      coin.scale.setScalar(1);
      blankCoin.position.set(0, 1.2, 0);
      blankCoin.rotation.set(0, 0, 0);
      blankCoin.scale.setScalar(1);
      die.position.set(0, 3, 0);
      die.rotation.set(0, 0, 0);
      die.scale.setScalar(1);
      blade.position.set(0, 0, 0);
      blade.rotation.set(0, 0, 0);
      blade.scale.setScalar(1);
      key.position.set(-3, 5, 4);
      key.target.position.set(0, 0, 0);
      key.angle = 0.6; key.penumbra = 1.0;
      rim.position.set(3, 2, -5);
      floor.scale.setScalar(1);
      coin.setClip(0);
      coin.setMetal('gold', 'tin', 0);
      coin.setRelief(1);
      coin.setEmissive([0, 0, 0], 0);
      blankCoin.visible = false;
      floor.visible = true;
      floor.position.y = 0;
      die.visible = false;
      blade.visible = false;
      sparks.visible = false;
      key.intensity = 9;
      key.color.set(0xffe2b0);
      rim.intensity = 2.5;
      rim.color.set(0xffb86b);
      scene.environmentIntensity = 1.0;
      dust.visible = true;
      dust.setTime(ctx.t);
    },
  };
  return S;
}
