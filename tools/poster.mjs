// Renders still frames without the chain bar (posters, social cards).
// node tools/poster.mjs <out.jpg> <t> [--w 1920 --h 1080]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const W = Number(opt('--w', 1920)), H = Number(opt('--h', 1080));
const [out, t] = args;
const { server, port } = await serve(root);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`http://127.0.0.1:${port}/index.html?capture&w=${W}&h=${H}`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
const url = await page.evaluate((t) => window.__frame(t, 0.9, false), Number(t));
fs.writeFileSync(path.resolve(out), Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
server.close();
console.log(out);
