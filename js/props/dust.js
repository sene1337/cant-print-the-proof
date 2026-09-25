// Floating dust caught in the light. Positions are a pure function of time.
import * as THREE from 'three';
import { hash1 } from '../util.js';

function sprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
const SPRITE = sprite();

export class Dust extends THREE.Points {
  constructor({ count = 1500, size = 0.02, box = [8, 5, 8], color = [1, 0.85, 0.6], gain = 1.2, seed = 1 } = {}) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size, map: SPRITE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      color: new THREE.Color(...color).multiplyScalar(gain), sizeAttenuation: true,
    });
    super(geo, mat);
    this.n = count; this.box = box; this.seed = seed;
    this.frustumCulled = false;
  }
  setTime(t, drift = [0.02, 0.05, 0]) {
    const p = this.geometry.attributes.position.array;
    const [bx, by, bz] = this.box;
    for (let i = 0; i < this.n; i++) {
      const s = i * 3 + this.seed * 99991;
      const x = hash1(s) * bx + t * drift[0] * (0.5 + hash1(s + 7)) + Math.sin(t * 0.3 + i) * 0.05;
      const y = hash1(s + 1) * by + t * drift[1] * (0.5 + hash1(s + 8));
      const z = hash1(s + 2) * bz + t * drift[2];
      p[i * 3] = ((x % bx) + bx) % bx - bx / 2;
      p[i * 3 + 1] = ((y % by) + by) % by - by / 2;
      p[i * 3 + 2] = ((z % bz) + bz) % bz - bz / 2;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}
