// Paper money: thousands of fluttering notes drawn as one instanced mesh.
// The paper reads as paper: ink relief from the print (normal map), a soft sheen, a little light through the sheet when
// it is backlit, and a gentle curl (about half the notes also keep a soft centre fold). The flutter is unchanged.
import * as THREE from 'three';
import { hash1 } from '../util.js';
import { noteExtras, normalFromHeight } from '../tex.js';

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

// The ink relief read with the same back-face flip as the print (its x slope flips with it).
const NORMAL_CHUNK = THREE.ShaderChunk.normal_fragment_maps
  .replace('texture2D( normalMap, vNormalMapUv )', `texture2D( normalMap, ${flipUv('vNormalMapUv')} )`)
  .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;\n\tmapN.x *= gl_FrontFacing ? 1.0 : - 1.0;');

// Light through the paper: a direct light behind the sheet (seen from the camera's side) adds a share of its light,
// filtered by the print, so a backlit note glows and its ink shows dark. Every direct light goes through RE_Direct.
const TRANSLUCENT_GLSL = /* glsl */ `
  uniform float uTranslucency;
  void RE_Direct_NotePaper( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal,
      const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
    RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    float through = saturate( dot( - geometryNormal, directLight.direction ) );
    reflectedLight.directDiffuse += through * directLight.color * BRDF_Lambert( material.diffuseColor ) * uTranslucency;
  }
  #undef RE_Direct
  #define RE_Direct RE_Direct_NotePaper
`;

// Paper shading for any note material whose shader already has readableBothSides: relief read both ways round, and
// light through the sheet. U must hold uTranslucency ({ value }).
export function paperShading(sh, U) {
  sh.uniforms.uTranslucency = U.uTranslucency;
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <normal_fragment_maps>', NORMAL_CHUNK)
    .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${TRANSLUCENT_GLSL}`);
}

// Paper tooth for a print that carries no relief of its own (a tiling normal map, deterministic).
let PAPER_NORMAL = null;
export function paperNormal() {
  if (PAPER_NORMAL) return PAPER_NORMAL;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = hash1(i * 5 + 1) < 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${0.05 + hash1(i * 5 + 2) * 0.1})`;
    g.fillRect(hash1(i * 5 + 3) * 256, hash1(i * 5 + 4) * 256, 1 + hash1(i * 5 + 5) * 3, 1);
  }
  PAPER_NORMAL = normalFromHeight(c, 0.9, 0.6);
  PAPER_NORMAL.wrapS = PAPER_NORMAL.wrapT = THREE.RepeatWrapping;
  PAPER_NORMAL.repeat.set(5, 2.2);
  return PAPER_NORMAL;
}

// The sheet's shape in object space: flutter (as before), plus a per-note curl and, on about half the notes, a soft
// centre fold. uShape scales the curl and fold (1 = on).
const SHAPE_GLSL = /* glsl */ `
  float notePhase = aPhase * 6.2831;
  float noteCurl = uShape * (0.035 + 0.075 * fract(aPhase * 7.31));
  float noteFold = uShape * 0.045 * step(0.45, fract(aPhase * 3.17));
`;

function bendMaterial(map, { emissive = 0.08, rough = 0.85, normalMap = null, sheen = 0.25, translucency = 0.3 } = {}) {
  const extras = noteExtras(map);
  const nmap = normalMap || (extras && extras.normalMap) || paperNormal();
  const mat = new THREE.MeshPhysicalMaterial({
    map, side: THREE.DoubleSide, roughness: rough, metalness: 0,
    emissive: new THREE.Color(1, 1, 1), emissiveMap: map, emissiveIntensity: emissive,
    normalMap: nmap, normalScale: new THREE.Vector2(0.5, 0.5),
    sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.92, 0.96, 0.92),
  });
  mat.userData.uniforms = { uTime: { value: 0 }, uFlutter: { value: 1 }, uShape: { value: 1 }, uTranslucency: { value: translucency } };
  mat.customProgramCacheKey = () => 'note-cloud-paper-2';
  mat.onBeforeCompile = (sh) => {
    readableBothSides(sh);
    paperShading(sh, mat.userData.uniforms);
    sh.uniforms.uTime = mat.userData.uniforms.uTime;
    sh.uniforms.uFlutter = mat.userData.uniforms.uFlutter;
    sh.uniforms.uShape = mat.userData.uniforms.uShape;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aPhase;
        uniform float uTime, uFlutter, uShape;`)
      .replace('#include <beginnormal_vertex>', `
        ${SHAPE_GLSL}
        vec3 objectNormal = vec3(normal);
        float dz = cos(position.x * 1.7 + uTime * (3.0 + aPhase * 2.0) + notePhase) * 0.16 * 1.7 * uFlutter;
        float dzs = 2.0 * noteCurl * position.x / (1.175 * 1.175) + noteFold * position.x / sqrt(position.x * position.x + 0.004);
        objectNormal = normalize(vec3(-(dz + dzs), 0.0, 1.0));`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float bend = sin(position.x * 1.7 + uTime * (3.0 + aPhase * 2.0) + notePhase) * 0.16
                   + sin(position.y * 2.3 + uTime * 2.1 + notePhase * 1.3) * 0.07;
        transformed.z += bend * uFlutter * (0.4 + abs(position.x));
        float nx = position.x / 1.175;
        transformed.z += noteCurl * nx * nx + noteFold * (sqrt(position.x * position.x + 0.004) - 0.063);`);
  };
  return mat;
}

export class NoteCloud extends THREE.InstancedMesh {
  // opts: emissive, rough, normalMap (defaults to the print's own relief), sheen, translucency.
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
  setShape(k) { this.material.userData.uniforms.uShape.value = k; }

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
