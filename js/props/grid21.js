// Exactly 21,000,000 lights: 5,000 x 4,200, drawn in one shader, grouped in 2,100 tiles of 100 x 100
// (10,000 lights each) so the count stays readable from any distance. The grid has a hard edge.
import * as THREE from 'three';

export const COLS = 5000, ROWS = 4200;          // 21,000,000 lights
export const TILE = 100, GAP = 14;              // tiles of 100 x 100 lights, 14-light gaps between tiles
export const TX = COLS / TILE, TY = ROWS / TILE; // 50 x 42 = 2,100 tiles
export const WIDTH = TX * (TILE + GAP) - GAP;   // world units (1 unit = one light's cell)
export const HEIGHT = TY * (TILE + GAP) - GAP;

// World position (centre of the grid at the origin) of light (col, row).
export function lightPos(col, row) {
  const x = Math.floor(col / TILE) * (TILE + GAP) + (col % TILE) + 0.5 - WIDTH / 2;
  const y = Math.floor(row / TILE) * (TILE + GAP) + (row % TILE) + 0.5 - HEIGHT / 2;
  return [x, y];
}

export class Grid21 extends THREE.Mesh {
  constructor() {
    const geo = new THREE.PlaneGeometry(WIDTH, HEIGHT, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(1.0, 0.45, 0.08) },
        uGain: { value: 3.0 },
        uFar: { value: 0.9 },
        uTime: { value: 0 },
        uFill: { value: 1.0 },
        uHero: { value: new THREE.Vector2(2500, 2100) },
        uHeroGain: { value: 0 },
        uTwinkle: { value: 0.35 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() {
          vP = uv * vec2(${WIDTH}.0, ${HEIGHT}.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uGain, uFar, uTime, uFill, uHeroGain, uTwinkle; uniform vec2 uHero;
        varying vec2 vP;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          const float T = ${TILE}.0, G = ${GAP}.0, P = ${TILE + GAP}.0;
          vec2 tileId = floor(vP / P);
          vec2 inTile = vP - tileId * P;
          float inside = step(inTile.x, T) * step(inTile.y, T);
          vec2 cell = tileId * T + floor(min(inTile, vec2(T - 0.001)));
          vec2 f = fract(inTile) - 0.5;
          float fw = max(fwidth(vP.x), fwidth(vP.y));
          float r = 0.28;
          float dotA = 1.0 - smoothstep(r - fw * 0.7, r + fw * 0.7, length(f));
          float avg = 3.14159 * r * r;
          // Light detail fades as a cell shrinks below a pixel; a tile shrinking below a pixel fades too.
          float k = smoothstep(0.35, 1.3, fw);
          float a = mix(dotA * uGain, avg * uGain * uFar, k);
          // tile gaps stay dark but fade to a fine texture once tiles are tiny
          float kt = smoothstep(0.35, 1.3, fw / P);
          float tileCover = (T * T) / (P * P);
          a = mix(a * inside, avg * uGain * uFar * tileCover, kt);
          float idx = cell.y * ${COLS}.0 + cell.x;
          float filled = step(idx, uFill * ${COLS * ROWS}.0 - 0.5);
          float tw = 1.0 + uTwinkle * (h(cell) - 0.5) * (1.0 - k) + 0.25 * sin(uTime * 2.0 + h(cell * 1.7) * 30.0) * (1.0 - k);
          vec3 col = uColor * a * tw * filled;
          float hero = (1.0 - step(0.5, max(abs(cell.x - uHero.x), abs(cell.y - uHero.y)))) * inside;
          col += vec3(1.0, 0.75, 0.4) * hero * dotA * uHeroGain;
          col += uColor * a * 0.05 * (1.0 - filled);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    super(geo, mat);
    this.frustumCulled = false;
  }
  set(t, { fill = 1, gain = 2.2, far = 0.55, hero = 0, twinkle = 0.35 } = {}) {
    const u = this.material.uniforms;
    u.uTime.value = t; u.uFill.value = fill; u.uGain.value = gain; u.uFar.value = far; u.uHeroGain.value = hero; u.uTwinkle.value = twinkle;
  }
}

// A bright frame around the grid: the edge of the supply.
export function gridEdge() {
  const w = WIDTH + 40, h = HEIGHT + 40;
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2]];
  const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], 0.5)));
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(1, 0.6, 0.2).multiplyScalar(2.2) }));
}
