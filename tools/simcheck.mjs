// Screenshots the simulator (desktop and phone) in several states and reports console errors and frame times.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'out/site');
const { server, port } = await serve(root, 0);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ' ' + m.text()); });
  page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?debug`);
  // like a visitor: the film finishes loading, then they scroll down to the simulator
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('sim').scrollIntoView({ block: 'start' }));
  await page.waitForFunction(() => document.getElementById('simScene').classList.contains('ready') || document.getElementById('simScene').classList.contains('no-3d'), null, { timeout: 60000 });
  await page.waitForFunction(() => !/Checking/.test(document.getElementById('pxHint').textContent), null, { timeout: 10000 });
  await page.evaluate(() => document.querySelector(innerWidth >= 960 ? '.sim-grid' : '#simScene').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(2500);
  const shot = async (tag) => {
    await page.locator('#simScene').screenshot({ path: `${out}/${name}-scene-${tag}.png` });
    await page.screenshot({ path: `${out}/${name}-sim-${tag}.png` });
  };
  await shot('default');
  // frame time over two seconds of the idle scene
  const ft = await page.evaluate(() => new Promise((ok) => { const t = []; let last = performance.now(); const f = (ts) => { t.push(ts - last); last = ts; if (t.length < 120) requestAnimationFrame(f); else ok(t.sort((a, b) => a - b)[60]); }; requestAnimationFrame(f); }));
  const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  await set('sSpend', 1000); await page.waitForTimeout(2200); await shot('late');
  await set('sSpend', 200); await page.waitForTimeout(2200); await shot('soon');
  await set('sSpend', 541);
  await set('sBtc', 0); await set('sAssets', 0); await set('sEarn', 0); await page.waitForTimeout(2200); await shot('never');
  await set('sBtc', 492); await set('sAssets', 500); await set('sEarn', 500);
  // every digit once, through the debug hook
  for (const y of [2047, 2089, 2536]) { await page.evaluate((y) => window.__sunrise.show(y, 20), y); await page.waitForTimeout(1500); await page.locator('#simScene').screenshot({ path: `${out}/${name}-scene-${y}.png` }); }
  await page.evaluate(() => document.getElementById('sSpend').dispatchEvent(new Event('input', { bubbles: true })));
  await page.evaluate(() => { document.getElementById('simAdv').open = true; document.querySelector('#simPaths [data-path="borrow"]').click(); });
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.getElementById('simAdv').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-borrow.png` });
  await page.evaluate(() => document.querySelector('#simPaths [data-path="strc"]').click());
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-strc.png` });
  const r = await page.evaluate(() => ({ verdict: document.getElementById('simVerdict').textContent, results: [...document.querySelectorAll('.sim-results div')].map((d) => d.querySelector('dt').textContent + ': ' + d.querySelector('dd').textContent), paths: [...document.querySelectorAll('#simPaths b')].map((b) => b.textContent), scroll: document.documentElement.scrollWidth - innerWidth }));
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  console.log(name, 'median frame ms', ft.toFixed(1), JSON.stringify(r), '\n' + logs.slice(0, 10).join('\n'));
  await ctx.close();
}
await browser.close();
server.close();
