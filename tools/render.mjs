// Renders the film to MP4 by drawing every frame in headless Chrome and muxing the song.
// node tools/render.mjs [--from 0] [--to 184.03] [--w 1920] [--h 1080] [--workers 6] [--name film] [--keep]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const has = (k) => args.includes(k);
const FPS = 30;
const T0 = Number(opt('--from', 0)), T1 = Number(opt('--to', 184.03));
const W = Number(opt('--w', 1920)), H = Number(opt('--h', 1080));
const WK = Number(opt('--workers', 6));
const NAME = opt('--name', `film-${W}x${H}`);
const outDir = path.join(root, 'out');
const frameDir = path.join(outDir, 'frames', NAME);
const f0 = Math.round(T0 * FPS), f1 = Math.round(T1 * FPS);
const n = f1 - f0;

fs.mkdirSync(frameDir, { recursive: true });
const { server, port } = await serve(root);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const start = Date.now();
let done = 0;
const errors = [];
await Promise.all([...Array(WK)].map(async (_, w) => {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?capture&w=${W}&h=${H}`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  const failed = await page.evaluate(() => window.__failed || {});
  if (w === 0 && Object.keys(failed).length) console.warn('FAILED SECTIONS', Object.keys(failed));
  for (let f = f0 + w; f < f1; f += WK) {
    const file = path.join(frameDir, `f_${String(f).padStart(6, '0')}.jpg`);
    if (!has('--force') && fs.existsSync(file)) { done++; continue; }
    const url = await page.evaluate((t) => window.__frame(t, 0.95), f / FPS);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    if (++done % 150 === 0) {
      const s = (Date.now() - start) / 1000;
      console.log(`${done}/${n} frames  ${s.toFixed(0)} s  ${(done / s).toFixed(1)} fps`);
    }
  }
  await page.close();
}));
await browser.close();
server.close();
if (errors.length) console.warn('page errors:', [...new Set(errors)].slice(0, 5));

// Audio: the approved master, limited to -1.5 dBFS for delivery, so AAC stays under -1 dBTP (4x oversampled peak limiter). Loudness unchanged otherwise.
const song = path.join(root, 'media/song.mp3');
const wav = path.join(outDir, 'song-delivery.wav');
if (!fs.existsSync(wav)) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', song, '-af', 'aresample=192000,alimiter=limit=0.84:attack=2:release=60:level=false,aresample=48000', '-c:a', 'pcm_s24le', wav]);
}
const master = path.join(outDir, `${NAME}-master.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error',
  '-framerate', String(FPS), '-start_number', String(f0), '-i', path.join(frameDir, 'f_%06d.jpg'),
  '-ss', String(T0), '-t', String(n / FPS), '-i', wav,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'film',
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-frames:v', String(n), master]);
console.log('wrote', master, `${((Date.now() - start) / 1000).toFixed(0)} s total`);
if (has('--share')) {
  const share = path.join(outDir, `${NAME}-x.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', master,
    '-c:v', 'libx264', '-preset', 'slow', '-b:v', '14M', '-maxrate', '16M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', share]);
  console.log('wrote', share);
}
