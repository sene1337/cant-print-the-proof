// Verse 3 coin studio: the orange coin that can't be copied (double-spend) and can't be clipped (the shears).
import * as THREE from 'three';
import { studioEnv } from '../film.js';
import { Coin } from '../props/coin.js';
import { bitcoinGlyph, edgeText } from '../tex.js';
import { orangeFace, coinMap, Motes } from '../props/verse3-kit.js';
import { clamp, lerp, hash1, smooth, easeOut, easeIn, easeInOut } from '../util.js';

export const CR = 1, CT = 0.16;           // coin radius and thickness
export const RISER_H = 1.1;               // top of the riser for the shears shot

// Translucent copy of a coin: the face shows through as light, edges glow, lines flicker.
function ghostMaterial(faceColor) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: faceColor }, uColor: { value: new THREE.Color(1.0, 0.5, 0.14) },
      uAlpha: { value: 1 }, uTime: { value: 0 }, uJitter: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv * 0.5 + 0.5;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uAlpha, uTime, uJitter;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float m = texture2D(uMap, vUv).r;
        float fres = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float scan = 0.88 + 0.12 * sin(gl_FragCoord.y * 1.3);
        float flick = 1.0;
        vec3 col = uColor * (0.12 + 0.55 * smoothstep(0.85, 1.0, m)) + uColor * pow(fres, 2.0) * 1.2;
        gl_FragColor = vec4(col * uAlpha * scan * flick, 1.0);
      }`,
  });
}

// The coin broken into shards: annular sectors with jagged radial seams. Each shard is centred on its own origin.
function shardGeometries(seed = 5) {
  const N = 9, RIN = 0.48;
  const h = (i) => hash1(i * 31 + seed * 977);
  const ang = [...Array(N)].map((_, k) => (k / N) * Math.PI * 2 + (h(k) - 0.5) * 0.35);
  const seam = (k, r) => ang[k % N] + (h(k * 7 + Math.round(r * 10)) - 0.5) * 0.28 * (r > 0.1 ? 1 : 0);
  const ringR = (a, k) => RIN * (1 + (h(k * 3 + 1) - 0.5) * 0.3);
  const out = [];
  for (let k = 0; k < N; k++) {
    const a0 = ang[k], a1 = k + 1 < N ? ang[k + 1] : ang[0] + Math.PI * 2;
    for (let ring = 0; ring < 2; ring++) {
      const pts = [];
      const r0 = ring === 0 ? 0 : ringR(a0, k), r1 = ring === 0 ? ringR(a0, k) : CR;
      const rm = (r0 + r1) / 2;
      // along seam k outward
      pts.push([r0 ? Math.cos(a0) * r0 : 0, r0 ? Math.sin(a0) * r0 : 0]);
      const am = seam(k, rm);
      pts.push([Math.cos(am) * rm, Math.sin(am) * rm]);
      // outer arc
      for (let i = 0; i <= 8; i++) { const a = a0 + (a1 - a0) * (i / 8); pts.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
      // back along seam k+1
      const am2 = seam(k + 1, rm) + (k + 1 < N ? 0 : Math.PI * 2);
      pts.push([Math.cos(am2) * rm, Math.sin(am2) * rm]);
      if (r0) for (let i = 8; i >= 0; i--) { const a = a0 + (a1 - a0) * (i / 8); pts.push([Math.cos(a) * r0, Math.sin(a) * r0]); }
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x - cx, y - cy)));
      const g = new THREE.ExtrudeGeometry(sh, { depth: CT, bevelEnabled: false });
      g.translate(0, 0, -CT / 2);
      // face UVs back in coin space so the glyph lines up across shards
      const uv = g.attributes.uv, pos = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + cx, pos.getY(i) + cy);
      out.push({ geo: g, cx, cy });
    }
  }
  return out;
}

// Shears like the ones that clipped the gold: two steel jaws on a brass bolt, iron handles.
function jawShape(sign) {
  const s = new THREE.Shape();
  const P = (x, y) => [x, y * sign];
  s.moveTo(...P(-0.34, 0));
  s.lineTo(...P(1.7, 0));
  s.quadraticCurveTo(...P(1.52, 0.1), ...P(1.05, 0.2));
  s.quadraticCurveTo(...P(0.55, 0.3), ...P(0.12, 0.34));
  s.quadraticCurveTo(...P(-0.34, 0.34), ...P(-0.34, 0));
  return s;
}
function buildShears() {
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x8d9298, metalness: 1, roughness: 0.3 });
  const edge = new THREE.MeshPhysicalMaterial({ color: 0xe9edf2, metalness: 1, roughness: 0.18 });
  const iron = new THREE.MeshPhysicalMaterial({ color: 0x23201e, metalness: 0.85, roughness: 0.45 });
  const brass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.85, 0.62, 0.3), metalness: 1, roughness: 0.3 });
  const T = 0.075;
  const G = new THREE.Group();
  const pieces = [];
  for (const sign of [1, -1]) {
    const piece = new THREE.Group();
    const jaw = new THREE.Mesh(new THREE.ExtrudeGeometry(jawShape(sign), { depth: T, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 }), steel);
    jaw.position.z = sign > 0 ? 0.004 : -T - 0.004;
    jaw.castShadow = true;
    piece.add(jaw);
    const bev = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.035, 0.02), edge);
    bev.position.set(0.68, 0.02 * sign, sign > 0 ? 0.004 : -0.004);
    piece.add(bev);
    const pts = [[-0.2, 0.0], [-0.9, -0.16], [-1.9, -0.36], [-2.9, -0.5]].map(([x, y]) => new THREE.Vector3(x, y * sign, (sign > 0 ? 1 : -1) * T * 0.5));
    const shank = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.085, 12, false), iron);
    shank.castShadow = true;
    piece.add(shank);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), iron);
    cap.position.copy(pts[3]);
    piece.add(cap);
    G.add(piece);
    pieces.push(piece);
  }
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, T * 2 + 0.08, 24), brass);
  bolt.rotation.x = Math.PI / 2;
  G.add(bolt);
  return { group: G, upper: pieces[0], lower: pieces[1] };
}

export async function verse3CoinStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnv(film.renderer, [
    { pos: [0, 6, 2], size: [6, 2.5], color: [1, 0.93, 0.85], intensity: 2.4 },
    { pos: [-6, 1.2, 2], size: [0.5, 5], color: [1, 0.75, 0.5], intensity: 3.0 },
    { pos: [6, 0.8, -1], size: [0.4, 5], color: [0.9, 0.93, 1], intensity: 2.6 },
    { pos: [0, 0.4, -6], size: [7, 0.3], color: [1, 0.6, 0.25], intensity: 2.0 },
    { pos: [1.5, 2.5, 6], size: [4, 2.2], color: [1, 0.9, 0.78], intensity: 1.6 },
    { pos: [0, 1.4, 7], size: [6, 3.2], color: [1, 0.9, 0.8], intensity: 1.1 },
    { pos: [-1, 3.2, -6], size: [9, 3.5], color: [1, 0.88, 0.74], intensity: 1.5 },
    { pos: [-3, -0.5, 5], size: [3, 0.6], color: [1, 0.7, 0.4], intensity: 1.4 },
  ], { top: [0.42, 0.38, 0.34], horizon: [0.1, 0.08, 0.06], bottom: [0.01, 0.008, 0.006] });
  scene.environmentIntensity = 1.0;

  const key = new THREE.SpotLight(0xfff0dc, 8, 30, 0.6, 1.0, 1.5);
  key.position.set(-3.5, 5.5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffb070, 2.0);
  rim.position.set(3, 3, -5);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const riser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.62, RISER_H, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.2 }),
  );
  riser.position.y = RISER_H / 2;
  riser.castShadow = riser.receiveShadow = true;
  scene.add(riser);

  const face = orangeFace(bitcoinGlyph);
  const coin = new Coin({ radius: CR, thickness: CT, face, back: face, metal: 'orange', edge: edgeText("CAN'T PRINT THE PROOF"), seed: 21 });
  for (const m of [coin.faceMat, coin.backMat]) { m.roughnessMap = coinMap(face.rough, CR); m.roughness = 1; m.needsUpdate = true; }
  scene.add(coin);

  // Two insubstantial copies, and the shards of the one that fails.
  const ghostTex = face.color;
  const ghosts = [0, 1].map(() => { const g = new THREE.Mesh(coin.mesh.geometry, ghostMaterial(ghostTex)); scene.add(g); return g; });
  const shardMat = ghostMaterial(ghostTex);
  const shardDefs = shardGeometries(5);
  const shards = shardDefs.map((d) => { const m = new THREE.Mesh(d.geo, shardMat); scene.add(m); return m; });

  const sparks = new Motes({ count: 140, size: 0.028, color: [1, 0.7, 0.35], gain: 3.5 });
  scene.add(sparks);
  const sparks2 = new Motes({ count: 90, size: 0.024, color: [1, 0.8, 0.5], gain: 3 });
  scene.add(sparks2);

  const shears = buildShears();
  scene.add(shears.group);

  const S = {
    scene, key, rim, floor, riser, coin, ghosts, shards, shardDefs, sparks, sparks2, shears,
    fx: { bloom: 0.45, threshold: 1.0, bloomRadius: 0.4, grain: 0.04, vignette: 0.5, tint: [1.02, 0.99, 0.95] },
    update(ctx) {
      coin.visible = true;
      coin.position.set(0, 1.5, 0);
      coin.rotation.set(0, 0, 0);
      coin.scale.setScalar(1);
      coin.setClip(0);
      coin.setEmissive([1, 0.4, 0.05], 0);
      for (const g of ghosts) { g.visible = false; g.position.set(0, 1.5, 0); g.rotation.set(0, 0, 0); g.material.uniforms.uTime.value = ctx.t; }
      for (const s of shards) s.visible = false;
      shardMat.uniforms.uTime.value = ctx.t;
      sparks.visible = false; sparks2.visible = false;
      shears.group.visible = false;
      riser.visible = false;
      floor.visible = true;
      key.position.set(-3.5, 5.5, 4); key.target.position.set(0, 1.2, 0); key.intensity = 8;
      rim.intensity = 2.0;
      scene.environmentIntensity = 1.0;
    },

    // Double-spend: the coin stays put; a glowing copy materializes beside it (tSplit), and at tFail the copy
    // cracks apart and drifts away as it fades. Nothing textured slides across the frame (flash-safe).
    doubleSpend(t, { tSplit, tFail, y = 1.5, x0 = -1.12, x1 = 1.12 }) {
      floor.visible = false;
      const turn = Math.sin(t * 1.1) * 0.08;
      coin.position.set(x0, y, 0);
      coin.rotation.set(0, turn, 0);
      const af = t - tFail;
      // the real coin warms gently when the copy fails
      coin.setEmissive([1, 0.5, 0.12], af > 0 ? 0.18 * smooth(clamp(af / 0.2)) * Math.exp(-Math.max(0, af - 0.2) * 3) : 0);
      const g = ghosts[0];
      if (t < tFail) {
        const k = smooth(clamp((t - tSplit) / 0.28));
        g.visible = k > 0;
        g.position.set(x1, y, 0);
        g.rotation.set(0, turn, 0);
        g.material.uniforms.uAlpha.value = 0.85 * k;
        g.material.uniforms.uJitter.value = 0;
        return;
      }
      // the copy breaks: its pieces part slowly and fall a little, fading out
      shards.forEach((m, i) => {
        const d = shardDefs[i];
        const h = (k) => hash1(i * 17 + k + 900);
        const out = Math.hypot(d.cx, d.cy) + 0.25;
        const sp = 0.55 + h(1) * 0.35;
        m.visible = af < 0.75;
        m.position.set(x1 + d.cx * (1 + af * sp / out), y + d.cy * (1 + af * sp / out) - 0.6 * af * af, (h(3) - 0.4) * af * 0.6);
        m.rotation.set(af * (h(4) - 0.5) * 1.6, af * (h(5) - 0.5) * 1.6, turn + af * (h(6) - 0.5) * 1.2);
      });
      shardMat.uniforms.uAlpha.value = 0.85 * (1 - smooth(clamp(af / 0.7)));
      shardMat.uniforms.uJitter.value = 0;
    },

    // The shears bite at the rim and can't cut. Coin lies flat on the riser; tBite is the snap.
    shearsAt(t, { tBite, tIn, tOut }) {
      riser.visible = true;
      const y = RISER_H + CT / 2;
      coin.position.set(0, y, 0);
      coin.rotation.set(-Math.PI / 2, 0, 0.4 + t * 0.05);
      const ab = t - tBite;
      // coin shudders on the hit
      const sh = ab > 0 ? Math.exp(-ab * 9) * Math.sin(ab * 70) * 0.02 : 0;
      coin.rotation.x += sh; coin.rotation.y += sh * 0.6;
      coin.setEmissive([1, 0.42, 0.05], ab > 0 ? 0.15 * Math.exp(-ab * 8) : 0);
      // shears: slide in from the right, open wide, snap, bounce off, retreat
      shears.group.visible = true;
      const zc = 0.72, pivotX = 1.3;
      const inK = easeOut(clamp((t - tIn) / (tBite - 0.12 - tIn)), 2);
      const outK = easeIn(clamp((t - tOut) / 0.5), 2);
      const kick = ab > 0 ? easeOut(clamp(ab / 0.35), 2) : 0;
      shears.group.position.set(pivotX + (1 - inK) * 3.2 + kick * 0.45 + outK * 3.5, y + kick * 0.12, zc + kick * 0.2);
      shears.group.rotation.set(0, Math.PI - kick * 0.12, kick * 0.18);
      const blocked = Math.atan(0.085 / 0.62);
      let open;
      if (ab < -0.12) open = lerp(0.18, 0.46, smooth(clamp((t - tIn) / (tBite - 0.12 - tIn))));
      else if (ab < 0) open = lerp(0.46, blocked, easeIn((ab + 0.12) / 0.12, 3));
      else open = blocked + (0.3 - blocked) * easeOut(clamp(ab / 0.25), 2) + Math.exp(-ab * 10) * Math.sin(ab * 60) * 0.03;
      shears.upper.rotation.z = open;
      shears.lower.rotation.z = -open;
      // sparks off the rim where the jaws hit, top and bottom
      const cx = Math.sqrt(1 - zc * zc) * CR;
      sparks.burst(ab, [cx, y + CT / 2, zc], { power: 0.9, spread: 1.6, up: 0.5, dir: [0.35, 0, 0.25], life: 0.75, gravity: 7, seed: 7 });
      sparks2.burst(ab, [cx, y - CT / 2, zc], { power: 0.7, spread: 1.4, up: -0.2, dir: [0.35, 0, 0.25], life: 0.6, gravity: 7, seed: 9 });
    },
  };
  return S;
}
