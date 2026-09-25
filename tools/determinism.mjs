// Renders the same song times in two different orders in two fresh pages and compares the pixels.
// Any difference means some stage keeps state from the previous frame.
import { chromium } from 'playwright';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const step = Number(process.argv[2] || 0.5);
const times = []; for (let t = 0.25; t < 184; t += step) times.push(+t.toFixed(3));
const { server, port } = await serve(root);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
async function run(order) {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await page.goto(`http://127.0.0.1:${port}/index.html?capture&w=480&h=270`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
  const out = new Map();
  const urls = new Map();
  for (const t of order) {
    const url = await page.evaluate((t) => window.__frame(t, 1.0, false), t);
    out.set(t, crypto.createHash('sha256').update(url).digest('hex'));
    urls.set(t, url);
  }
  await page.close();
  out.urls = urls;
  return out;
}
const a = await run(times);
const shuffled = times.slice().sort((x, y) => Math.sin(x * 12.9898) - Math.sin(y * 12.9898));
const b = await run(shuffled);
const bad = times.filter((t) => a.get(t) !== b.get(t));
console.log(`${times.length} frames compared, ${bad.length} differ`);
if (bad.length) {
  console.log('differ at', bad.join(' '));
  fs.mkdirSync(path.join(root, 'out/determinism'), { recursive: true });
  for (const t of bad) {
    fs.writeFileSync(path.join(root, `out/determinism/${t}-a.jpg`), Buffer.from(a.urls.get(t).split(',')[1], 'base64'));
    fs.writeFileSync(path.join(root, `out/determinism/${t}-b.jpg`), Buffer.from(b.urls.get(t).split(',')[1], 'base64'));
  }
}
await browser.close(); server.close();
