// One printed note texture shared by every bridge stage (drawn once at boot), and a fix so paper reads from both sides.
import * as THREE from 'three';
import { banknote } from '../tex.js';

let cached = null;
export function bridgeNote() {
  if (!cached) cached = banknote({ seed: 8, serial: 'F 20080915 L' });
  return cached;
}

// A double-sided plane shows its texture mirror-reversed from behind. Flip U on back faces so a note's print
// reads correctly whichever side faces the camera. Keeps any onBeforeCompile the material already has.
// (Includes are expanded after onBeforeCompile, so the map chunks are swapped for patched copies.)
const FLIP = (uv) => `bridgeFlipUv( ${uv} )`;
const MAP_CHUNK = THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', `texture2D( map, ${FLIP('vMapUv')} )`);
const EMISSIVE_CHUNK = THREE.ShaderChunk.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', `texture2D( emissiveMap, ${FLIP('vEmissiveMapUv')} )`);
if (!MAP_CHUNK.includes('bridgeFlipUv') || !EMISSIVE_CHUNK.includes('bridgeFlipUv')) console.warn('bridge-note: map chunk changed; back faces will read mirrored');

export function readableBothSides(mat, tag = 'note') {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        vec2 bridgeFlipUv(vec2 uv) { return gl_FrontFacing ? uv : vec2(1.0 - uv.x, uv.y); }`)
      .replace('#include <map_fragment>', MAP_CHUNK)
      .replace('#include <emissivemap_fragment>', EMISSIVE_CHUNK);
  };
  mat.customProgramCacheKey = () => `bridge-both-sides-${tag}`;
  mat.needsUpdate = true;
  return mat;
}
