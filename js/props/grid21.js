// Exactly 21,000,000 lights: a 5,000 x 4,200 grid drawn in one shader, with a hard edge.
import * as THREE from 'three';

export const COLS = 5000, ROWS = 4200; // 21,000,000

export class Grid21 extends THREE.Mesh {
  constructor() {
    const geo = new THREE.PlaneGeometry(COLS, ROWS, 1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: false,
      depthWrite: true,
      uniforms: {
        uColor: { value: new THREE.Color(1.0, 0.45, 0.08) },
        uGain: { value: 3.0 },
        uTime: { value: 0 },
        uFill: { value: 1.0 },      // fraction of the supply drawn (row-major from the bottom)
        uHero: { value: new THREE.Vector2(COLS / 2, ROWS / 2) },
        uHeroGain: { value: 0 },
        uTwinkle: { value: 0.35 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vCell;
        void main() {
          vCell = uv * vec2(${COLS}.0, ${ROWS}.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uGain, uTime, uFill, uHeroGain, uTwinkle; uniform vec2 uHero;
        varying vec2 vCell;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 id = floor(vCell);
          vec2 f = fract(vCell) - 0.5;
          float fw = max(fwidth(vCell.x), fwidth(vCell.y));
          float r = 0.26;
          float dotA = 1.0 - smoothstep(r - fw * 0.7, r + fw * 0.7, length(f));
          float avg = 3.14159 * r * r;
          float k = smoothstep(0.35, 1.2, fw);
          float a = mix(dotA, avg, k);
          float idx = id.y * ${COLS}.0 + id.x;
          float filled = step(idx, uFill * ${COLS * ROWS}.0 - 0.5);
          float tw = 1.0 + uTwinkle * (h(id) - 0.5) * (1.0 - k) + 0.25 * sin(uTime * 2.0 + h(id * 1.7) * 30.0) * (1.0 - k);
          vec3 col = uColor * a * uGain * tw * filled;
          float hero = 1.0 - step(0.5, max(abs(id.x - uHero.x), abs(id.y - uHero.y)));
          col += vec3(1.0, 0.75, 0.4) * hero * dotA * uHeroGain;
          // faint unfilled ghost cells so the finite frame is always visible
          col += uColor * a * 0.05 * (1.0 - filled);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    super(geo, mat);
    this.frustumCulled = false;
  }
  set(t, { fill = 1, gain = 3, hero = 0, twinkle = 0.35 } = {}) {
    const u = this.material.uniforms;
    u.uTime.value = t; u.uFill.value = fill; u.uGain.value = gain; u.uHeroGain.value = hero; u.uTwinkle.value = twinkle;
  }
}

// A bright frame around the grid: the edge of the supply.
export function gridEdge() {
  const w = COLS, h = ROWS;
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2]];
  const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], 0.5)));
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(1, 0.6, 0.2).multiplyScalar(2.5) }));
}
