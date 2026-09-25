// The drop (109.73-112.23): the music stops. One note falls through a shaft of light and lands on dark stone.
import * as THREE from 'three';
import { normalFromHeight } from '../tex.js';
import { bridgeNote } from '../props/bridge-note.js';
import { clamp, hash1, lerp, rng, smooth } from '../util.js';

export const DROP = { t0: 109.73, tLand: 111.93, top: 9.5, beamH: 26, beamR: 2.75 };

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

// Falling-leaf motion: glide one way tilted into the motion, stall, turn, glide back.
export function notePose(t) {
  const { t0, tLand, top } = DROP;
  const T = tLand - t0;
  const u = clamp((t - t0) / T);
  const w = (Math.PI * 2) / 1.15;
  const ph = (Math.min(t, tLand) - t0) * w + 0.6;
  const damp = 1 - smooth(clamp((u - 0.82) / 0.18));
  // descent: gentle ease in, slows as it nears the floor (air cushion)
  const yLin = lerp(top, 0.03, u * (1.12 - 0.12 * u));
  const y = t >= tLand ? 0.03 : yLin + Math.cos(2 * ph) * 0.12 * damp;
  const x = Math.sin(ph) * 0.72 * damp + 0.1;
  const z = Math.sin(ph * 0.5) * 0.25 * damp;
  const roll = -Math.cos(ph) * 0.55 * damp;
  const pitch = Math.sin(ph * 0.5 + 0.4) * 0.18 * damp;
  const yaw = 0.35 + (Math.min(t, tLand) - t0) * 0.4;
  // after landing: a tiny slide
  const slide = t > tLand ? (1 - Math.exp(-(t - tLand) * 6)) * 0.12 : 0;
  return { x: x + slide, y, z, roll, pitch, yaw, u };
}

export async function dropStage(film) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const lamp = new THREE.SpotLight(0xfff1dc, 34, 60, 0.108, 0.45, 0.7);
  lamp.position.set(0, DROP.beamH, 0);
  lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0004;
  lamp.shadow.radius = 3;
  scene.add(lamp, lamp.target);
  const amb = new THREE.AmbientLight(0x1a1712, 0.35);
  scene.add(amb);

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
  const noteMat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
  const note = new THREE.Mesh(geo, noteMat);
  note.castShadow = true;
  note.rotation.x = -Math.PI / 2;
  const noteRoll = new THREE.Group(); noteRoll.add(note);
  const noteYaw = new THREE.Group(); noteYaw.add(noteRoll);
  noteYaw.scale.setScalar(0.8);
  scene.add(noteYaw);

  const S = {
    scene, lamp, beam, dust, floor, note, noteYaw, noteRoll,
    fx: { bloom: 0.35, threshold: 1.15, bloomRadius: 0.4, grain: 0.06, vignette: 0.6, tint: [1.02, 1.0, 0.96], sat: 0.85, shake: 0.0015 },
    notePose,
    update(ctx) {
      const t = ctx.t;
      const q = notePose(t);
      noteYaw.position.set(q.x, q.y, q.z);
      noteYaw.rotation.set(0, q.yaw, 0);
      noteRoll.rotation.set(q.pitch, 0, q.roll);
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
      lamp.intensity = 34;
      beam.material.uniforms.uGain.value = 0.48;
    },
  };
  return S;
}
