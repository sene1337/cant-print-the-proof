// A proof block: a dark cube with its hash engraved in light on every face.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { blockFace, blockFaceEngraved } from '../tex.js';

const faceCache = new Map();
function face(hash, height, nonce, label) {
  const k = `${hash}|${height}|${label}`;
  if (!faceCache.has(k)) faceCache.set(k, blockFace({ hash, height, nonce, label }));
  return faceCache.get(k);
}

const GEO = new RoundedBoxGeometry(1, 1, 1, 4, 0.05);

export class Block extends THREE.Group {
  constructor({ hash, height, nonce, label = 'BLOCK', glow = 2.2, style = 'neon' }) {
    super();
    if (style === 'engraved') {
      // Dark bronze, the numbers cut into every face and lit from inside the cuts.
      const f = blockFaceEngraved({ hash, height, nonce, label });
      this.mat = new THREE.MeshPhysicalMaterial({
        map: f.color, normalMap: f.normal, normalScale: new THREE.Vector2(1.4, 1.4),
        metalness: 0.85, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.2,
        emissive: new THREE.Color(1, 1, 1), emissiveMap: f.emissive, emissiveIntensity: 1.4,
      });
      this.mesh = new THREE.Mesh(GEO, this.mat);
      this.mesh.castShadow = true;
      this.add(this.mesh);
      this.edges = { material: { opacity: 0 } };
      this.baseGlow = 1.4;
      return;
    }
    const t = face(hash, height, nonce, label);
    this.mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.02, 0.016, 0.012), metalness: 0.7, roughness: 0.28,
      clearcoat: 1, clearcoatRoughness: 0.12,
      emissive: new THREE.Color(1, 0.55, 0.12), emissiveMap: t, emissiveIntensity: glow,
    });
    this.mesh = new THREE.Mesh(GEO, this.mat);
    this.mesh.castShadow = true;
    this.add(this.mesh);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: new THREE.Color(1, 0.5, 0.1).multiplyScalar(3), transparent: true, opacity: 0.9 }),
    );
    this.edges = edges;
    this.add(edges);
    this.baseGlow = glow;
  }
  setGlow(k) {
    this.mat.emissiveIntensity = this.baseGlow * k;
    if (this.edges.isLineSegments) this.edges.material.opacity = Math.min(1, 0.9 * k);
  }
}

// Glowing bar linking two blocks.
export function link(len = 1, thick = 0.06) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(thick, thick, len),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.1).multiplyScalar(4) }),
  );
  return m;
}
