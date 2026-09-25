// The chain bar: a quiet strip at the bottom of every frame naming the block this frame is.
import { fmtInt } from './util.js';

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
  const shade = (w / h < 1.2 ? 130 : 90) * s;
  const grd = g.createLinearGradient(0, h - shade, 0, h);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.32)');
  g.fillStyle = grd;
  g.fillRect(0, h - shade, w, shade);

  const narrow = w / h < 1.2;
  const pad = (narrow ? 34 : 40) * s;
  const fs = Math.round((narrow ? 23 : 17) * s);
  const y1 = narrow ? h - 78 * s : y;
  g.textBaseline = 'middle';
  g.font = `600 ${fs}px "Figtree"`;
  g.fillStyle = 'rgba(255,244,228,0.78)';
  g.textAlign = 'left';
  g.fillText(`BLOCK ${fmtInt(i)}`, pad, y1);
  const bw = g.measureText(`BLOCK ${fmtInt(chain.n - 1)}`).width + 22 * s;

  g.font = `500 ${fs}px "JetBrains Mono"`;
  const hash = narrow ? b.hash.slice(0, 22) + '…' : b.hash;
  let zeros = b.hash.match(/^0*/)[0].length;
  let x = pad + bw;
  const cw = g.measureText('0').width;
  for (let k = 0; k < hash.length; k++) {
    g.fillStyle = k < zeros ? 'rgba(255,170,70,0.95)' : 'rgba(255,244,228,0.46)';
    g.fillText(hash[k], x, y1);
    x += cw;
  }
  g.textAlign = narrow ? 'left' : 'right';
  g.fillStyle = 'rgba(255,244,228,0.6)';
  g.fillText(`${fmtInt(chain.hashesUpTo(i))} hashes`, narrow ? pad : w - pad, narrow ? h - 40 * s : y);

  g.restore();
}
