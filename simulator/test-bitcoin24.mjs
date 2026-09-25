// Checks the simulator's model code against the Bitcoin24 v1.0 workbook (commit 30c97a7).
// Run: node simulator/test-bitcoin24.mjs   (Node 18+, no dependencies)
// The model lives inside index.html between the MODEL:BEGIN and MODEL:END markers; this file evaluates that block.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'index.html'), 'utf8');
const a = html.indexOf('/* MODEL:BEGIN */'), b = html.indexOf('/* MODEL:END */');
if (a < 0 || b < a) throw new Error('MODEL markers not found in index.html');
const M = new Function(html.slice(a, b) + '\nreturn SovModel;')();

let passed = 0, failed = 0;
function report(ok, name, detail) {
  ok ? passed++ : failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}
// Relative tolerance check.
function near(name, actual, expected, relTol, fmt = v => v.toPrecision(8)) {
  const err = Math.abs(actual / expected - 1);
  report(err <= relTol, name, `actual ${fmt(actual)}  expected ${fmt(expected)}  diff ${(err * 100).toFixed(4)}%  (limit ${relTol < 1e-4 ? (relTol * 100).toExponential(0) : (relTol * 100).toFixed(2)}%)`);
}
// Absolute tolerance check, in percentage points.
function nearPts(name, actual, expected, ptsTol) {
  const d = Math.abs(actual - expected) * 100;
  report(d <= ptsTol, name, `actual ${(actual * 100).toFixed(4)}%  expected ${(expected * 100).toFixed(4)}%  diff ${d.toFixed(4)} pts  (limit ${ptsTol} pts)`);
}
const $M = v => '$' + (v / 1e6).toFixed(4) + 'M';

// ---------- Bitcoin24 anchor: 2024, $65K, default inputs ----------
const cases = M.defaultAssumptions().cases;
const path = k => M.pricePath({ model: 'b24', c: cases[k], startYear: 2024, startPrice: 65000, endYear: 2045 });
const P = { bear: path('bear'), base: path('base'), bull: path('bull') };

console.log('\nBTC price (BTC and Macro sheets)');
near('2026 Base price (BTC!C16)', P.base.price[2026 - 2024], 143812.5, 0.001, v => '$' + v.toFixed(1));
near('2045 Bear price (BTC!L7 / Macro!X21)', P.bear.price2045, 68.13599650629455e12 / 20.968e6, 0.001, $M);
near('2045 Base price (BTC!M6)', P.base.price2045, 13.399566130733223e6, 0.001, $M);
near('2045 Bull price (BTC!N6)', P.bull.price2045, 49.22780964683621e6, 0.001, $M);

console.log('\nWorld assets (Macro sheet)');
nearPts('2045 Base BTC share of world assets (Macro!AG22)', P.base.share2045, 0.07049489533594591, 0.05);
nearPts('2045 Bear BTC share (BTC!L9)', P.bear.share2045, 0.018060080205793895, 0.05);
nearPts('2045 Bull BTC share (BTC!N9)', P.bull.share2045, 0.2179120560110045, 0.05);
near('2045 Base world assets (Macro!X29)', P.base.world2045, 3985.5666327367317e12, 0.001, v => '$' + (v / 1e12).toFixed(2) + 'T');
near('Equity implied return (Macro!X71)', M.impliedReturn('equity'), 0.08910891089108919, 1e-9, v => (v * 100).toFixed(4) + '%');
near('Real estate implied return (Macro!X72)', M.impliedReturn('realEstate'), 0.0490196078431373, 1e-9, v => (v * 100).toFixed(4) + '%');

console.log('\nIndividual sheet, 2045 net assets, Base case, default inputs');
const asm = M.defaultAssumptions();
function individual(i) {
  const st = M.STRATEGIES[i];
  const p = { startYear: 2024, endYear: 2045, stack: 0, assets: 1e6, earnings: 2e5, save: st.save, strategy: st,
    mix: asm.mix, returns: asm.returns, tax: asm.incomeTax, earningsGrowth: asm.earningsGrowth,
    mortgageShare: asm.mortgageShare, mortgageRate: asm.mortgageRate, spend: 0, inflation: 0 };
  return M.simulate(p, P.base.price, Infinity);
}
const expectNet = [null, 19.160762026075282, 107.75238108308346, 158.48442332368464, 213.2258302125592];
const expectBtc = [0, 0.9880531961761272, 7.9044255694090175, 11.803608884838194, 15.914910077368692];
const cells = ['C66', 'C67', 'C68', 'C69', 'C70'];
M.STRATEGIES.forEach((st, i) => {
  const r = individual(i), last = r.rows[r.rows.length - 1];
  if (expectNet[i] != null) near(`${st.name} net assets (Individual!${cells[i]})`, last.net, expectNet[i] * 1e6, 0.005, $M);
  else {
    const cagr = Math.pow(last.net / r.netStart, 1 / 21) - 1;
    nearPts(`Normie net-asset CAGR (Individual!D66), net ${$M(last.net)}`, cagr, 0.10834493777551524, 0.01);
  }
  if (expectBtc[i] > 0) near(`${st.name} BTC held in 2045 (Individual!E${66 + i})`, last.btc, expectBtc[i], 0.005, v => v.toFixed(4) + ' BTC');
});

// ---------- The simulator's anchoring and post-2045 extension ----------
console.log('\nSimulator anchoring (2026) and the post-2045 extension');
const p26 = M.modelPrice(cases.base, 2026);
const app = M.pricePath({ model: 'b24', c: cases.base, startYear: 2026, startPrice: p26, endYear: 2090 });
near('Anchored at 2026 on the model value, 2045 Base price', app.price2045, 13.399566130733223e6, 0.001, $M);
let maxDrift = 0, gMin = Infinity, gMax = -Infinity;
for (let y = 2046; y <= 2090; y++) {
  const i = y - 2026, cap = app.price[i] * M.supply(y), share = cap / (cap + M.worldOther(y));
  maxDrift = Math.max(maxDrift, Math.abs(share - app.share2045));
  const g = app.price[i] / app.price[i - 1] - 1; gMin = Math.min(gMin, g); gMax = Math.max(gMax, g);
}
report(maxDrift < 1e-9, 'BTC share of world assets holds at its 2045 level, 2046-2090', `max drift ${maxDrift.toExponential(2)} (limit 1e-9)`);
report(gMax < 0.12, 'Yearly BTC growth after 2045 stays with world assets', `range ${(gMin * 100).toFixed(2)}% to ${(gMax * 100).toFixed(2)}% (limit < 12%)`);
report(Math.abs(app.price[2046 - 2026] / app.price[2045 - 2026] - 1 - 0.0727) < 0.001, '2046 growth equals world non-BTC growth (about 7.27%)',
  `actual ${((app.price[20] / app.price[19] - 1) * 100).toFixed(3)}%`);

// ---------- Freedom-year logic ----------
console.log('\nFreedom-year sanity');
const Y0 = 2026, YEND = 2090, SMAX = 2075;
function life(o) {
  const st = M.STRATEGIES[o.strat ?? 2], a2 = M.defaultAssumptions();
  const pr = o.model === 'power'
    ? M.pricePath({ model: 'power', mult: o.mult ?? 1, startYear: Y0, endYear: YEND })
    : M.pricePath({ model: 'b24', c: a2.cases[o.case ?? 'base'], startYear: Y0, startPrice: o.price ?? 84000, endYear: YEND });
  const p = { startYear: Y0, endYear: YEND, stack: o.stack ?? 3, assets: o.assets ?? 1e6, earnings: o.earn ?? 2e5,
    save: o.save ?? st.save, strategy: st, mix: a2.mix, returns: a2.returns, tax: a2.incomeTax, earningsGrowth: a2.earningsGrowth,
    mortgageShare: a2.mortgageShare, mortgageRate: a2.mortgageRate, spend: o.spend ?? 2e5, inflation: o.inf ?? 0.07 };
  return { p, pr, r: M.solve(p, pr.price, SMAX) };
}
const yr = s => (s == null ? Infinity : s);
const stacks = [0, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 25, 50, 100];
const spends = [30e3, 50e3, 80e3, 120e3, 200e3, 300e3, 500e3, 1e6];
let combos = 0, bad = [];
for (const model of ['b24', 'power']) for (const k of ['bear', 'base', 'bull']) for (let strat = 0; strat < 5; strat++) for (const spend of spends) {
  let prev = Infinity;
  for (const stack of stacks) {
    const s = yr(life({ model, case: k, mult: { bear: .5, base: 1, bull: 1.6 }[k], strat, spend, stack }).r.s); combos++;
    if (s > prev) bad.push(`stack ${stack} ${model}/${k}/${M.STRATEGIES[strat].name}/spend ${spend}: ${s} after ${prev}`);
    prev = s;
  }
}
report(bad.length === 0, 'More stack never makes freedom later', `${combos} cases, ${bad.length} violations${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);
combos = 0; bad = [];
for (const model of ['b24', 'power']) for (const k of ['bear', 'base', 'bull']) for (let strat = 0; strat < 5; strat++) for (const stack of stacks) {
  let prev = -Infinity;
  for (const spend of spends) {
    const s = yr(life({ model, case: k, mult: { bear: .5, base: 1, bull: 1.6 }[k], strat, spend, stack }).r.s); combos++;
    if (s < prev) bad.push(`spend ${spend} ${model}/${k}/${M.STRATEGIES[strat].name}/stack ${stack}: ${s} before ${prev}`);
    prev = s;
  }
}
report(bad.length === 0, 'Higher cost never makes freedom earlier', `${combos} cases, ${bad.length} violations${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);
combos = 0; bad = [];
for (let strat = 0; strat < 5; strat++) for (const stack of stacks) for (const spend of spends) {
  const [sb, sm, su] = ['bear', 'base', 'bull'].map(k => yr(life({ case: k, strat, stack, spend }).r.s)); combos++;
  if (!(su <= sm && sm <= sb)) bad.push(`${M.STRATEGIES[strat].name}/stack ${stack}/spend ${spend}: bear ${sb} base ${sm} bull ${su}`);
}
report(bad.length === 0, 'Bull never later than Base, Base never later than Bear', `${combos} cases, ${bad.length} violations${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);

const rich = life({ stack: 100, spend: 30e3 }).r.s;
report(rich === 2026, '100 BTC and a $30K life: free now', `freedom year ${rich}`);
const broke = life({ stack: 0, assets: 0, earn: 0, spend: 1e6 }).r.s;
report(broke === null, 'Nothing owned, nothing earned, $1M life: not yet', `freedom year ${broke}`);
const d = life({}), s = d.r.s;
const after = d.r.rows.filter(x => x.y >= s);
report(s != null && after.every(x => x.net > 0) && !M.simulate(d.p, d.pr.price, s - 1).ok,
  'Default-like case: solvent from the freedom year to 2090, and one year earlier fails',
  `freedom ${s}; min net worth after it ${'$' + Math.round(Math.min(...after.map(x => x.net))).toLocaleString('en-US')}; year ${s - 1} ok=${M.simulate(d.p, d.pr.price, s - 1).ok}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
