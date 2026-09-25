// Renders chosen song times to JPEGs and a labelled contact sheet, for looking at the film without playing it.
import { fileURLToPath } from 'url';
// node tools/check.mjs <name> <t1> <t2> ... [--w 960 --h 540] [--vertical]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const W = Number(opt('--w', 960)), H = Number(opt('--h', 540));
const LOOK = opt('--look', '');
const name = args.shift();
const times = args.map(Number);
const outDir = path.join(root, 'out/check', name);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => { logs.push(`pageerror: ${e.message}`); console.error('pageerror:', e.message); process.exit(1); });
await page.goto(`http://127.0.0.1:${port}/index.html?capture&w=${W}&h=${H}${LOOK ? '&look=' + LOOK : ''}`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
const err = await page.evaluate(() => window.__error);
const failed = await page.evaluate(() => window.__failed || {});
for (const [k, v] of Object.entries(failed)) console.error(`SECTION FAILED: ${k}\n${v}`);
if (err) { console.error(err); console.error(logs.join('\n')); process.exit(1); }
const files = [];
for (const t of times) {
  let url;
  try { url = await page.evaluate((t) => window.__frame(t, 0.9), t); }
  catch (e) { console.error(`frame ${t}: ${e.message.split('\n')[0]}`); continue; }
  const f = path.join(outDir, `t_${t.toFixed(2).padStart(7, '0')}.jpg`);
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  files.push(f);
}
await browser.close();
server.close();
if (logs.length) console.log(logs.slice(0, 20).join('\n'));
const sheet = path.join(root, 'out/check', `${name}.jpg`);
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw, ImageFont
fs = sys.argv[2:]; out = sys.argv[1]
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
cols = 3 if len(ims) > 4 else 2
if len(ims) == 1: cols = 1
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 26)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 18)
except Exception: font = None
for i, (im, f) in enumerate(zip(ims, fs)):
    x, y = (i % cols) * w, (i // cols) * (h + 26)
    sheet.paste(im, (x, y + 26))
    d.text((x + 8, y + 3), f.split('/')[-1][2:-4] + 's', fill=(255, 200, 120), font=font)
sheet.save(out, quality=85)
`, sheet, ...files]);
console.log(sheet);
