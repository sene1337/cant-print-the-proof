// Verse 3, genesis: block zero traces itself out of the dark, and the bailout headline is stamped into it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv } from '../film.js';
import { blockFace } from '../tex.js';
import { canvas, canvasTex, Motes, sparkCard, fmt } from '../props/verse3-kit.js';
import { Dust } from '../props/dust.js';
import { clamp, lerp, hash1, smooth, easeOut, easeIn, easeInOut } from '../util.js';

export const GENESIS = {
  hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
  nonce: 2083236893,
  time: 1231006505,
  message: 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks',
};
export const GS = 1.5; // block size

// The side face: a frame, and (on its own layer) the coinbase text, laid out like a receipt.
function headlineFrame(w = 1024) {
  const c = canvas(w, w), g = c.getContext('2d');
  g.fillStyle = '#060504'; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#f7931a'; g.lineWidth = w * 0.012; g.strokeRect(w * 0.05, w * 0.05, w * 0.9, w * 0.9);
  g.fillStyle = '#f7931a';
  g.font = `700 ${Math.round(w * 0.042)}px "Figtree"`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText('BLOCK #0  ·  COINBASE', w * 0.1, w * 0.155);
  g.fillStyle = 'rgba(255,200,140,0.55)';
  g.font = `500 ${Math.round(w * 0.034)}px "JetBrains Mono"`;
  g.fillText(`TIME ${GENESIS.time}`, w * 0.1, w * 0.875);
  g.textAlign = 'right';
  g.fillText(`NONCE ${fmt(GENESIS.nonce)}`, w * 0.9, w * 0.875);
  // dashed rules, like a till receipt
  g.strokeStyle = 'rgba(247,147,26,0.55)'; g.lineWidth = w * 0.004; g.setLineDash([w * 0.018, w * 0.012]);
  for (const y of [0.2, 0.8]) { g.beginPath(); g.moveTo(w * 0.1, w * y); g.lineTo(w * 0.9, w * y); g.stroke(); }
  return canvasTex(c);
}
function headlineText(w = 1024) {
  const c = canvas(w, w), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const lines = ['The Times 03/Jan/2009', 'Chancellor on brink', 'of second bailout', 'for banks'];
  g.font = `700 ${Math.round(w * 0.066)}px "JetBrains Mono"`;
  const lh = w * 0.125, y0 = w * 0.345;
  lines.forEach((ln, i) => {
    g.fillStyle = i === 0 ? '#ffb347' : '#ffe8cc';
    g.fillText(ln, w * 0.1, y0 + i * lh);
  });
  return canvasTex(c);
}

// Black-glass block material with a top-down scan reveal (object-space y) and a hot scan line.
function revealMaterial(map) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.02, 0.016, 0.012), metalness: 0.7, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12,
    emissive: new THREE.Color(1, 0.55, 0.12), emissiveMap: map, emissiveIntensity: 2.2,
  });
  const u = { uReveal: { value: 1 }, uHalf: { value: 0.5 } };
  m.userData.reveal = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vObjY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vObjY; uniform float uReveal, uHalf;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float v3front = uHalf - uReveal * (2.0 * uHalf + 0.04);
        if (vObjY < v3front) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.62, 0.25) * 4.0 * exp(-abs(vObjY - v3front) * 60.0) * step(uReveal, 0.999);`);
  };
  m.customProgramCacheKey = () => 'verse3-reveal';
  return m;
}

export async function verse3GenesisStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 1.5], color: [1, 0.7, 0.4], intensity: 3 },
    { pos: [-6, 0, 1], size: [0.6, 5], color: [1, 0.6, 0.25], intensity: 4 },
    { pos: [5, 1, -3], size: [0.6, 5], color: [0.9, 0.9, 1], intensity: 2 },
  ]);
  scene.environmentIntensity = 0.8;
  const key = new THREE.SpotLight(0xffd0a0, 30, 20, 0.6, 0.7, 1.5);
  key.position.set(-2, 4, 3);
  scene.add(key, key.target);

  const front = blockFace({ hash: GENESIS.hash, height: '#0', nonce: GENESIS.nonce, w: 1024, label: 'GENESIS BLOCK' });
  const side = headlineFrame();
  const mats = [
    revealMaterial(side),  // +x: the coinbase headline
    revealMaterial(front), // -x
    revealMaterial(front), // +y
    revealMaterial(front), // -y
    revealMaterial(front), // +z: the front
    revealMaterial(front), // -z
  ];
  const block = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 4, 0.05), mats);
  block.add(body);
  block.scale.setScalar(GS);
  scene.add(block);

  // The stamped text sits just proud of the +x face.
  const textMat = new THREE.MeshBasicMaterial({ map: headlineText(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1, 1, 1) });
  const text = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), textMat);
  text.position.set(0.503, 0, 0);
  text.rotation.y = Math.PI / 2;
  block.add(text);

  // Twelve edges that trace out from one corner.
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.1).multiplyScalar(3) });
  const edgeGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 6, 1, true);
  const C = (x, y, z) => new THREE.Vector3(x * 0.502, y * 0.502, z * 0.502);
  const start = C(-1, -1, 1);
  const edges = [];
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push([x, y, z]);
  const key3 = (c) => c.join(',');
  const dist = (c) => (c[0] !== -1) + (c[1] !== -1) + (c[2] !== 1);
  for (const a of corners) for (const b of corners) {
    const diff = a.map((v, i) => v !== b[i]).filter(Boolean).length;
    if (diff !== 1 || key3(a) > key3(b)) continue;
    const [p, q] = dist(a) <= dist(b) ? [a, b] : [b, a];
    const m = new THREE.Mesh(edgeGeo, edgeMat);
    block.add(m);
    edges.push({ m, a: C(...p), b: C(...q), depth: dist(p) });
  }
  const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  const spark = sparkCard([1, 0.72, 0.4], 0.5);
  scene.add(spark);
  const sparkLight = new THREE.PointLight(0xff9a40, 0, 6, 2);
  scene.add(sparkLight);
  const dust = new Dust({ count: 600, size: 0.014, box: [8, 5, 8], color: [1, 0.7, 0.4], gain: 1.0 });
  scene.add(dust);
  const puff = new Motes({ count: 260, size: 0.03, color: [1, 0.72, 0.4], gain: 5 });
  scene.add(puff);

  const S = {
    scene, key, block, body, mats, text, textMat, edges, spark, dust, puff,
    fx: { bloom: 0.6, threshold: 1.0, bloomRadius: 0.4, grain: 0.04, vignette: 0.5, tint: [1.03, 0.98, 0.93] },
    update(ctx) {
      block.visible = true; block.position.set(0, 0, 0); block.rotation.set(0, 0, 0);
      for (const m of mats) { m.userData.reveal.uReveal.value = 1; m.emissiveIntensity = 2.2; }
      body.visible = true;
      text.visible = false; text.scale.setScalar(1); textMat.color.setScalar(1);
      for (const e of edges) e.m.visible = true, setEdge(e, 1);
      edgeMat.color.set(1, 0.5, 0.1).multiplyScalar(1.3);
      spark.visible = false; sparkLight.intensity = 0;
      dust.visible = true; dust.setTime(ctx.t, [0.02, 0.05, 0]);
      puff.visible = false;
    },
    // Birth: tSpark a point of light; tEdges the outline traces; tFaces the faces scan in; tGlow full power.
    birth(t, { tSpark, tEdges, tFaces, tGlow }) {
      const sp = clamp((t - tSpark) / 0.15);
      const ek = (t - tEdges) / 0.3; // edge units done (one corner-to-corner run per 0.3 s)
      spark.visible = t > tSpark && t < tFaces + 0.3;
      tmp.copy(start).multiplyScalar(GS);
      spark.position.copy(tmp);
      spark.material.opacity = sp * (t < tFaces ? 1 : clamp(1 - (t - tFaces) / 0.3));
      spark.scale.setScalar(0.42 + 0.04 * Math.sin(t * 23));
      sparkLight.position.copy(tmp); sparkLight.intensity = 1.2 * sp * clamp(1 - (t - tFaces) / 0.25);
      for (const e of edges) setEdge(e, clamp(ek - e.depth));
      const fr = clamp((t - tFaces) / 0.55);
      // traced lines are hot; once the faces are in, they settle to a rim
      edgeMat.color.set(1, 0.5, 0.1).multiplyScalar(lerp(2.6, 1.3, smooth(fr)));
      body.visible = fr > 0;
      for (const m of mats) {
        m.userData.reveal.uReveal.value = easeInOut(fr);
        const gd = t - tGlow;
        m.emissiveIntensity = 2.2 * (0.75 + 0.25 * smooth(clamp(gd * 4))) + 0.9 * (gd > 0 ? smooth(clamp(gd / 0.18)) * Math.exp(-Math.max(0, gd - 0.18) * 2.5) : 0);
      }
    },
    // The headline slams in on tStamp, white-hot, then cools to orange.
    stamp(t, tStamp) {
      const d = t - tStamp;
      text.visible = d > -0.12;
      const k = clamp((d + 0.12) / 0.12);
      // slams down from just above the face, never wider than the face's frame
      text.scale.setScalar(lerp(1.07, 1, easeIn(k, 2.2)));
      const heat = d > 0 ? Math.exp(-d * 6) : 0;
      textMat.color.setRGB(1 + heat * 0.8, 0.9 + heat * 0.6, 0.8 + heat * 0.5).multiplyScalar(0.25 + 0.75 * k);
      for (const m of mats) m.emissiveIntensity = 2.2 + (d > 0 ? 1.2 * Math.exp(-d * 6) : 0);
      puff.visible = d > 0;
      if (d > 0) puff.burst(d, [GS * 0.52, 0, 0], { power: 0.35, spread: 1.2, up: 0, dir: [0.5, 0, 0], life: 0.9, gravity: 0.4, seed: 21 });
    },
  };
  function setEdge(e, k) {
    e.m.visible = k > 0.001;
    if (!e.m.visible) return;
    tmp.copy(e.b).sub(e.a);
    const len = tmp.length();
    e.m.quaternion.setFromUnitVectors(UP, tmp.divideScalar(len));
    e.m.scale.set(1, len * k, 1);
    e.m.position.copy(e.a).addScaledVector(tmp, len * k / 2);
  }
  return S;
}
