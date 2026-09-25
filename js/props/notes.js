// Paper money: thousands of fluttering notes drawn as one instanced mesh.
import * as THREE from 'three';
import { hash1 } from '../util.js';

const NOTE_W = 2.35, NOTE_H = 1.0;

// A double-sided plane shows its print mirror-reversed from behind. Flip U on back faces so a note reads
// correctly from either side. (Technique from the bridge section's notes.)
const flipUv = (uv) => `noteFlipUv( ${uv} )`;
const MAP_CHUNK = THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', `texture2D( map, ${flipUv('vMapUv')} )`);
const EMISSIVE_CHUNK = THREE.ShaderChunk.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', `texture2D( emissiveMap, ${flipUv('vEmissiveMapUv')} )`);
export function readableBothSides(sh) {
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      vec2 noteFlipUv(vec2 uv) { return gl_FrontFacing ? uv : vec2(1.0 - uv.x, uv.y); }`)
    .replace('#include <map_fragment>', MAP_CHUNK)
    .replace('#include <emissivemap_fragment>', EMISSIVE_CHUNK);
}

function bendMaterial(map, { emissive = 0.08, rough = 0.85 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: rough, metalness: 0, emissive: new THREE.Color(1, 1, 1), emissiveMap: map, emissiveIntensity: emissive });
  mat.userData.uniforms = { uTime: { value: 0 }, uFlutter: { value: 1 } };
  mat.customProgramCacheKey = () => 'note-cloud-both-sides';
  mat.onBeforeCompile = (sh) => {
    readableBothSides(sh);
    sh.uniforms.uTime = mat.userData.uniforms.uTime;
    sh.uniforms.uFlutter = mat.userData.uniforms.uFlutter;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aPhase;
        uniform float uTime, uFlutter;`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float ph = aPhase * 6.2831;
        float bend = sin(position.x * 1.7 + uTime * (3.0 + aPhase * 2.0) + ph) * 0.16
                   + sin(position.y * 2.3 + uTime * 2.1 + ph * 1.3) * 0.07;
        transformed.z += bend * uFlutter * (0.4 + abs(position.x));`)
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = vec3(normal);
        float phn = aPhase * 6.2831;
        float dz = cos(position.x * 1.7 + uTime * (3.0 + aPhase * 2.0) + phn) * 0.16 * 1.7 * uFlutter;
        objectNormal = normalize(vec3(-dz, 0.0, 1.0));`);
  };
  return mat;
}

export class NoteCloud extends THREE.InstancedMesh {
  constructor(map, count, opts = {}) {
    const geo = new THREE.PlaneGeometry(NOTE_W, NOTE_H, 14, 5);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) phase[i] = hash1(i * 7 + 3);
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    super(geo, bendMaterial(map, opts), count);
    this.capacity = count;
    this.frustumCulled = false;
    this.castShadow = false;
    this.dummy = new THREE.Object3D();
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  setTime(t) { this.material.userData.uniforms.uTime.value = t; }
  setFlutter(k) { this.material.userData.uniforms.uFlutter.value = k; }

  // fn(i, dummy) positions each note; return false to hide it.
  layout(n, fn) {
    const d = this.dummy;
    let k = 0;
    for (let i = 0; i < n && k < this.capacity; i++) {
      d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
      if (fn(i, d) === false) continue;
      d.updateMatrix();
      this.setMatrixAt(k++, d.matrix);
    }
    this.count = k;
    this.instanceMatrix.needsUpdate = true;
  }
}

export const NOTE = { W: NOTE_W, H: NOTE_H };
