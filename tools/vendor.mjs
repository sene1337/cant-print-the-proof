// Copies the parts of three.js this site uses into vendor/, so the site needs no build step and no CDN.
// Follows relative imports so every addon brings its own dependencies.
import fs from 'fs';
import path from 'path';

const SRC = 'node_modules/three';
const OUT = 'vendor/three';
const ADDONS = [
  'postprocessing/EffectComposer.js',
  'postprocessing/RenderPass.js',
  'postprocessing/ShaderPass.js',
  'postprocessing/UnrealBloomPass.js',
  'postprocessing/OutputPass.js',
  'postprocessing/BokehPass.js',
  'environments/RoomEnvironment.js',
  'geometries/RoundedBoxGeometry.js',
  'utils/BufferGeometryUtils.js',
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['three.module.js', 'three.core.js']) fs.copyFileSync(`${SRC}/build/${f}`, `${OUT}/${f}`);
fs.copyFileSync(`${SRC}/LICENSE`, `${OUT}/LICENSE`);

const seen = new Set();
function copyAddon(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const from = path.join(SRC, 'examples/jsm', rel);
  const to = path.join(OUT, 'addons', rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const code = fs.readFileSync(from, 'utf8');
  fs.writeFileSync(to, code);
  for (const m of code.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    copyAddon(path.normalize(path.join(path.dirname(rel), m[1])));
  }
}
ADDONS.forEach(copyAddon);
console.log(`vendored three.js + ${seen.size} addon files`);
