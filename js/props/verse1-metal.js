// Real-looking tool materials for verse 1: worn steel, forged iron and a leather-wrapped grip.
// Textures are drawn once on canvases and shared (small: 512 px), so they cost little memory.
import * as THREE from 'three';
import { normalFromHeight } from '../tex.js';
import { hash1 } from '../util.js';

let cache = null;
function textures() {
  if (cache) return cache;
  const n = 512;
  // Worn steel: fine polishing scratches in many directions, a few deeper nicks.
  const sc = document.createElement('canvas'); sc.width = sc.height = n;
  const sg = sc.getContext('2d');
  sg.fillStyle = '#808080'; sg.fillRect(0, 0, n, n);
  for (let i = 0; i < 1400; i++) {
    const x = hash1(i * 5 + 1) * n, y = hash1(i * 5 + 2) * n, a = hash1(i * 5 + 3) * Math.PI, l = 8 + hash1(i * 5 + 4) * 60;
    const v = hash1(i * 5 + 5) < 0.5 ? 96 : 160;
    sg.strokeStyle = `rgba(${v},${v},${v},0.35)`; sg.lineWidth = 0.7;
    sg.beginPath(); sg.moveTo(x, y); sg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); sg.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = hash1(i * 3 + 91) * n, y = hash1(i * 3 + 92) * n, r = 2 + hash1(i * 3 + 93) * 4;
    const gr = sg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(40,40,40,0.8)'); gr.addColorStop(1, 'rgba(40,40,40,0)');
    sg.fillStyle = gr; sg.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const steelN = normalFromHeight(sc, 1.2, 0.6);
  steelN.wrapS = steelN.wrapT = THREE.RepeatWrapping;
  // roughness variation: polished where hands and use wear it, duller elsewhere
  const rc = document.createElement('canvas'); rc.width = rc.height = 256;
  const rg = rc.getContext('2d');
  rg.fillStyle = '#6a6a6a'; rg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const x = hash1(i * 7 + 11) * 256, y = hash1(i * 7 + 12) * 256, r = 10 + hash1(i * 7 + 13) * 40;
    const v = hash1(i * 7 + 14) < 0.5 ? 40 : 120;
    const gr = rg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${v},${v},${v},0.4)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    rg.fillStyle = gr; rg.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const steelR = new THREE.CanvasTexture(rc);
  steelR.wrapS = steelR.wrapT = THREE.RepeatWrapping;
  // Forged iron: hammer-peen dimples and forge scale.
  const ic = document.createElement('canvas'); ic.width = ic.height = n;
  const ig = ic.getContext('2d');
  ig.fillStyle = '#808080'; ig.fillRect(0, 0, n, n);
  for (let i = 0; i < 260; i++) {
    const x = hash1(i * 3 + 31) * n, y = hash1(i * 3 + 32) * n, r = 10 + hash1(i * 3 + 33) * 22;
    const gr = ig.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(60,60,60,0.55)'); gr.addColorStop(0.7, 'rgba(90,90,90,0.25)'); gr.addColorStop(1, 'rgba(128,128,128,0)');
    ig.fillStyle = gr; ig.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const ironN = normalFromHeight(ic, 1.6, 1.5);
  ironN.wrapS = ironN.wrapT = THREE.RepeatWrapping;
  const icc = document.createElement('canvas'); icc.width = icc.height = 256;
  const icg = icc.getContext('2d');
  icg.fillStyle = '#4a4744'; icg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    const x = hash1(i * 3 + 51) * 256, y = hash1(i * 3 + 52) * 256, r = 3 + hash1(i * 3 + 53) * 14;
    const t = hash1(i * 3 + 54);
    icg.fillStyle = t < 0.4 ? 'rgba(30,28,27,0.35)' : t < 0.75 ? 'rgba(96,88,80,0.25)' : 'rgba(110,70,44,0.18)';
    icg.beginPath(); icg.arc(x, y, r, 0, Math.PI * 2); icg.fill();
  }
  const ironC = new THREE.CanvasTexture(icc);
  ironC.colorSpace = THREE.SRGBColorSpace;
  ironC.wrapS = ironC.wrapT = THREE.RepeatWrapping;
  // Leather wrap: diagonal strips wound round a grip (u around, v along). Each strip is one rotated band with a
  // rounded shading across it; dark gaps where the strips overlap.
  const lc = document.createElement('canvas'); lc.width = 256; lc.height = 512;
  const lg = lc.getContext('2d');
  const lh = document.createElement('canvas'); lh.width = 256; lh.height = 512;
  const lhg = lh.getContext('2d');
  lg.fillStyle = '#2a170e'; lg.fillRect(0, 0, 256, 512);
  lhg.fillStyle = '#303030'; lhg.fillRect(0, 0, 256, 512);
  const bandW = 46, ang = -0.5;
  for (const [ctx, isH] of [[lg, false], [lhg, true]]) {
    ctx.save();
    ctx.translate(128, 256); ctx.rotate(ang);
    for (let k = -14; k <= 14; k++) {
      const y0 = k * bandW;
      const gr = ctx.createLinearGradient(0, y0, 0, y0 + bandW);
      if (isH) {
        gr.addColorStop(0, '#303030'); gr.addColorStop(0.15, '#b8b8b8'); gr.addColorStop(0.55, '#d0d0d0'); gr.addColorStop(0.9, '#8a8a8a'); gr.addColorStop(1, '#303030');
      } else {
        gr.addColorStop(0, '#1a0d07'); gr.addColorStop(0.15, '#5a3a26'); gr.addColorStop(0.5, '#4a2e1d'); gr.addColorStop(0.9, '#33200f'); gr.addColorStop(1, '#140a05');
      }
      ctx.fillStyle = gr; ctx.fillRect(-400, y0 + 2, 800, bandW - 4);
    }
    ctx.restore();
  }
  // grain and wear on the leather
  for (let i = 0; i < 1600; i++) {
    const x = hash1(i * 3 + 71) * 256, y = hash1(i * 3 + 72) * 512;
    lg.fillStyle = hash1(i * 3 + 73) < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(120,84,56,0.1)';
    lg.fillRect(x, y, 2, 2);
  }
  const leatherC = new THREE.CanvasTexture(lc);
  leatherC.colorSpace = THREE.SRGBColorSpace;
  leatherC.wrapS = leatherC.wrapT = THREE.RepeatWrapping;
  const leatherN = normalFromHeight(lh, 2.0, 1.5);
  leatherN.wrapS = leatherN.wrapT = THREE.RepeatWrapping;
  cache = { steelN, steelR, ironN, ironC, leatherC, leatherN };
  return cache;
}

const rep = (t, r) => { const c = t.clone(); c.repeat.set(r[0], r[1]); c.needsUpdate = true; return c; };

// Bright, worn tool steel: polished edges catch the light, scratches and nicks in the reflections.
export function wornSteel({ color = 0xc4c9cf, roughness = 0.26, repeat = [2, 2], env = null } = {}) {
  const t = textures();
  const m = new THREE.MeshPhysicalMaterial({
    color, metalness: 1, roughness, roughnessMap: rep(t.steelR, repeat),
    normalMap: rep(t.steelN, repeat), normalScale: new THREE.Vector2(0.5, 0.5),
  });
  if (env) m.envMap = env;
  return m;
}

// Dark forged iron with hammer marks and scale.
export function forgedIron({ repeat = [2, 2], env = null } = {}) {
  const t = textures();
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: rep(t.ironC, repeat), metalness: 0.8, roughness: 0.52,
    normalMap: rep(t.ironN, repeat), normalScale: new THREE.Vector2(1.1, 1.1),
  });
  if (env) m.envMap = env;
  return m;
}

// A grip wound with a leather strap.
export function leatherWrap({ repeat = [1, 1] } = {}) {
  const t = textures();
  return new THREE.MeshStandardMaterial({
    color: 0xffffff, map: rep(t.leatherC, repeat), roughness: 0.62, metalness: 0,
    normalMap: rep(t.leatherN, repeat), normalScale: new THREE.Vector2(1.4, 1.4),
  });
}
