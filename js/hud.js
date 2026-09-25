// The chain bar: a quiet strip at the bottom of every frame naming the block this frame is.
import { fmtInt, clamp } from './util.js';

export function drawHud(g, w, h, chain, t, { alpha = 1 } = {}) {
  g.clearRect(0, 0, w, h);
  if (alpha <= 0) return;
  const i = chain.frameAt(t);
  const b = chain.block(i);
  const s = h / 1080;
  const y = h - 34 * s;
  g.save();
  g.globalAlpha = alpha;
  // soft shade so the type reads on bright frames
  const grd = g.createLinearGradient(0, h - 90 * s, 0, h);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = grd;
  g.fillRect(0, h - 90 * s, w, 90 * s);

  const pad = 40 * s;
  g.textBaseline = 'middle';
  g.font = `600 ${Math.round(15 * s)}px "Figtree"`;
  g.fillStyle = 'rgba(255,244,228,0.78)';
  g.textAlign = 'left';
  g.fillText(`BLOCK ${fmtInt(i)}`, pad, y);
  const bw = g.measureText(`BLOCK ${fmtInt(chain.n - 1)}`).width + 22 * s;

  g.font = `500 ${Math.round(15 * s)}px "JetBrains Mono"`;
  const hash = b.hash;
  let zeros = hash.match(/^0*/)[0].length;
  let x = pad + bw;
  const cw = g.measureText('0').width;
  for (let k = 0; k < hash.length; k++) {
    g.fillStyle = k < zeros ? 'rgba(255,170,70,0.95)' : 'rgba(255,244,228,0.46)';
    g.fillText(hash[k], x, y);
    x += cw;
  }
  g.textAlign = 'right';
  g.font = `500 ${Math.round(15 * s)}px "JetBrains Mono"`;
  g.fillStyle = 'rgba(255,244,228,0.6)';
  g.fillText(`${fmtInt(chain.hashesUpTo(i))} hashes`, w - pad, y);

  // progress: the chain so far
  const p = clamp((i + 1) / chain.n);
  g.fillStyle = 'rgba(255,244,228,0.14)';
  g.fillRect(0, h - 3 * s, w, 3 * s);
  g.fillStyle = 'rgba(247,147,26,0.9)';
  g.fillRect(0, h - 3 * s, w * p, 3 * s);
  g.restore();
}
