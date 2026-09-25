// Screenshots the website as a visitor sees it (desktop and phone), then plays the live film for a few seconds.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'out/site');
const { server, port } = await serve(root);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 120000 });
  await page.screenshot({ path: `${out}/${name}-cover.png` });
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  await page.click('#play');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/${name}-playing.png` });
  const st = await page.evaluate(() => ({ t: document.getElementById('clock').textContent, paused: document.querySelector('#pause').classList.contains('paused') }));
  await page.evaluate(() => document.querySelector('[data-seek="44.2"]').click());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}-seek.png` });
  await page.click('#verifyBtn');
  await page.waitForFunction(() => /blocks hash below|failed/.test(document.getElementById('verifyOut').textContent), null, { timeout: 120000 });
  const v = await page.evaluate(() => document.getElementById('verifyOut').textContent);
  await page.locator('#verifyOut').screenshot({ path: `${out}/${name}-verify.png` });
  console.log(name, JSON.stringify(st), '\n' + v, logs.slice(0, 8).join('\n'));
  await ctx.close();
}
await browser.close();
server.close();
