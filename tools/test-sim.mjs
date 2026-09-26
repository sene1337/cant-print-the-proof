// Checks the simulator's model (js/sim/model.js): against the Bitcoin24 v1.0 workbook (commit 30c97a7), against the
// first version of the simulator, and for the tax, borrowing and STRC additions.
// Run: node tools/test-sim.mjs   (Node 18+, no dependencies)
import * as M from '../js/sim/model.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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


// ---------- The first version, for regression (only when its draft is present) ----------
const v1file = join(dirname(fileURLToPath(import.meta.url)), '../simulator/index.html');
if (existsSync(v1file)) {
  console.log('\nSame answers as the first version when there is no tax and costs are met by selling');
  const html = readFileSync(v1file, 'utf8');
  const a = html.indexOf('/* MODEL:BEGIN */'), b = html.indexOf('/* MODEL:END */');
  const V1 = new Function(html.slice(a, b) + '\nreturn SovModel;')();
  let n = 0, diff = [];
  for (const k of ['bear', 'base', 'bull']) for (let strat = 0; strat < 5; strat++) for (const stack of [0, 0.5, 3, 25]) for (const spend of [5e4, 2e5, 8e5]) {
    const L = life({ case: k, strat, stack, spend }), r1 = V1.solve(L.p, L.pr.price, SMAX); n++;
    const a1 = L.r.rows[L.r.rows.length - 1].net, b1 = r1.rows[r1.rows.length - 1].net;
    if (L.r.s !== r1.s || Math.abs(a1 - b1) > Math.abs(b1) * 1e-12 + 1e-6) diff.push(`${k}/${strat}/${stack}/${spend}: ${L.r.s} vs ${r1.s}`);
  }
  report(diff.length === 0, 'Freedom year and 2090 net worth match the first version', `${n} cases, ${diff.length} differ${diff.length ? ': ' + diff.slice(0, 3).join('; ') : ''}`);
}

// ---------- Taxes ----------
console.log('\nTaxes on selling bitcoin');
const withOpts = (o, extra) => { const L = life(o); Object.assign(L.p, extra); return { p: L.p, pr: L.pr, r: M.solve(L.p, L.pr.price, SMAX) }; };
{
  let n = 0, bad = [];
  for (const k of ['bear', 'base', 'bull']) for (const stack of [0.5, 3, 25]) for (const spend of [8e4, 2e5, 5e5]) for (const cgt of [0.1, 0.25, 0.5]) {
    const a = yr(withOpts({ case: k, stack, spend }, { basis: 20000, cgt: 0 }).r.s), b = yr(withOpts({ case: k, stack, spend }, { basis: 20000, cgt }).r.s); n++;
    if (b < a) bad.push(`${k}/${stack}/${spend}/${cgt}: ${b} before ${a}`);
  }
  report(bad.length === 0, 'Tax never makes freedom earlier', `${n} cases, ${bad.length} violations${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);
  const a = withOpts({ stack: 3, spend: 2e5 }, { basis: 1e12, cgt: 0.5 }), b = withOpts({ stack: 3, spend: 2e5 }, { basis: 1e12, cgt: 0 });
  report(a.r.s === b.r.s && a.r.taxPaid === 0, 'No gain, no tax: a cost above every price changes nothing', `freedom ${a.r.s} vs ${b.r.s}, tax ${a.r.taxPaid}`);
  // One sale, checked by hand: all gain (cost 0), 25% tax. Raising $75K after tax needs $100K of bitcoin.
  const one = withOpts({ stack: 10, assets: 0, earn: 0, spend: 75000, inf: 0 }, { basis: 0, cgt: 0.25 });
  const r0 = M.simulate(one.p, one.pr.price, 2026).rows[0];
  near('Selling with no cost basis at 25% tax: coins sold for a $75K year', r0.sold * r0.price, 100000, 1e-9, v => '$' + v.toFixed(2));
  near('The same sale gives up $25K of bitcoin to tax', r0.taxBtc * r0.price, 25000, 1e-9, v => '$' + v.toFixed(2));
}

// ---------- Borrowing against bitcoin ----------
console.log('\nBorrowing against bitcoin');
{
  const B = (maxLtv, rate = 0.1) => ({ path: 'borrow', basis: 20000, cgt: 0.25, borrow: { rate, maxLtv, liqLtv: 0.8 } });
  const a = withOpts({ stack: 3, spend: 2e5 }, B(0)), b = withOpts({ stack: 3, spend: 2e5 }, { basis: 20000, cgt: 0.25 });
  report(a.r.s === b.r.s && Math.abs(a.r.rows[64].net - b.r.rows[64].net) < 1e-3, 'A borrowing cap of 0% is the same as selling', `freedom ${a.r.s} vs ${b.r.s}`);
  let n = 0, over = 0;
  for (const k of ['bear', 'base', 'bull']) for (const cap of [0.1, 0.25, 0.4]) for (const rate of [0.05, 0.12, 0.2]) {
    const L = withOpts({ case: k, stack: 5, spend: 3e5 }, B(cap, rate));
    for (const row of L.r.rows) { n++; if (row.loan > cap * row.btc * row.price * (1 + 1e-9) + 1e-6) over++; }
  }
  report(over === 0, 'The loan never ends a year above its cap', `${n} years checked, ${over} over the cap`);
  const c = withOpts({ stack: 5, spend: 2e5 }, B(0.3));
  report(c.r.crashMargin > 0 && c.r.crashMargin <= 1 && Math.abs(c.r.crashMargin - (1 - c.r.peakLtv / 0.8)) < 1e-12,
    'Crash margin = 1 - peak loan-to-value / liquidation level', `peak LTV ${(c.r.peakLtv * 100).toFixed(1)}%, margin ${(c.r.crashMargin * 100).toFixed(1)}%`);
  // The lender liquidates at liqLtv, so a free run's loan never reaches it, even with the cap set at or above it.
  let runs = 0, bad = 0, capped = 0;
  for (const k of ['bear', 'base', 'bull']) for (const [cap, liq] of [[0.6, 0.4], [0.5, 0.5], [0.3, 0.8], [0.45, 0.4]]) for (const spend of [1e5, 2e5, 4e5]) for (const rate of [0.05, 0.2]) {
    const L = withOpts({ case: k, stack: 5, spend }, { path: 'borrow', basis: 20000, cgt: 0.25, borrow: { rate, maxLtv: cap, liqLtv: liq } });
    if (L.r.s == null) continue;
    runs++;
    if (L.r.peakLtv >= liq) bad++;
    if (cap >= liq && L.r.s !== withOpts({ case: k, stack: 5, spend }, { path: 'borrow', basis: 20000, cgt: 0.25, borrow: { rate, maxLtv: cap, liqLtv: 1 } }).r.s) capped++;
  }
  report(bad === 0 && capped > 0, 'A free run\'s loan never reaches the liquidation level', `${runs} free runs, ${bad} reach it; a cap at or above it delays freedom in ${capped} runs`);
}

// ---------- STRC ----------
console.log('\nSwapping bitcoin for STRC');
{
  const S = (share, rate = 0.12, roc = true) => ({ path: 'strc', basis: 20000, cgt: 0.25, strc: { share, rate, roc } });
  const a = withOpts({ stack: 3, spend: 2e5 }, S(0)), b = withOpts({ stack: 3, spend: 2e5 }, { basis: 20000, cgt: 0.25 });
  report(a.r.s === b.r.s, 'Swapping 0% for STRC is the same as selling', `freedom ${a.r.s} vs ${b.r.s}`);
  // By hand: 10 BTC, cost 0, 25% tax; swap half in 2026 at the 2026 price; 12% dividend, returned capital first.
  const L = withOpts({ stack: 10, assets: 0, earn: 0, spend: 0, inf: 0 }, S(0.5, 0.12, true));
  const r = M.simulate(L.p, L.pr.price, 2026), y0 = r.rows[0], px = L.pr.price[0];
  const swapTax = 5 * (px - 20000) * 0.25, strc0 = 5 * px - swapTax;
  near('The swap: half the stack, less 25% tax on the gain over a $20K cost, buys STRC', y0.strc, strc0, 1e-12, v => '$' + v.toFixed(0));
  const taxUntil = r.rows.findIndex(x => x.taxPaid > swapTax + 1e-6);
  report(taxUntil === Math.floor(1 / 0.12), 'Dividends are tax-free until they have returned the cost (the 9th dividend at 12%)', `first taxed year index ${taxUntil}`);
  const noRoc = withOpts({ stack: 10, assets: 0, earn: 0, spend: 0, inf: 0 }, S(0.5, 0.12, false));
  const r2 = M.simulate(noRoc.p, noRoc.pr.price, 2026);
  near('Without return of capital, dividends are taxed as income from year one', r2.rows[0].taxPaid - swapTax, strc0 * 0.12 * noRoc.p.tax, 1e-9, v => '$' + v.toFixed(0));
  // All the bitcoin swapped, no dividend, no gain: costs of $10K a year come from selling STRC at $100.
  const all = withOpts({ stack: 10, assets: 0, earn: 0, spend: 10000, inf: 0 }, { path: 'strc', basis: 1e12, cgt: 0.25, strc: { share: 1, rate: 0, roc: true } });
  const ra = M.simulate(all.p, all.pr.price, 2026), last = ra.rows[ra.rows.length - 1];
  near('With all bitcoin swapped and no dividend, STRC is sold at $100 to pay costs', last.strc, 10 * all.pr.price[0] - 65 * 10000, 1e-9, v => '$' + v.toFixed(0));
  report(ra.ok, 'That run stays solvent through 2090', `ok ${ra.ok}`);
}

// ---------- Rates ease after 2045 (the simulator's own long-run rule) ----------
console.log('\nRates ease after 2045');
{
  const E = M.defaultAssumptions().ease;
  report(E.after === 2045 && E.floor === 0.02 && E.halfLife === 5, 'Default: after 2045, toward 2% (Bitcoin24\'s CPI), gap halves every 5 years', JSON.stringify(E));
  report(M.eased(0.07, 2045, E) === 0.07 && M.eased(0.01, 2080, E) === 0.01, 'Unchanged through 2045, and a rate at or below 2% is never raised', `${M.eased(0.07, 2045, E)}, ${M.eased(0.01, 2080, E)}`);
  near('Five years on, the gap above 2% has halved: 7% becomes 4.5%', M.eased(0.07, 2050, E), 0.045, 1e-12);
  // Costs: your rate through 2045, then easing.
  const L = life({ stack: 3, spend: 2e5, inf: 0.07 }); L.p.ease = E;
  const r = M.simulate(L.p, L.pr.price, 2030), rows = r.rows, g = (y) => rows[y - Y0].spend / rows[y - Y0 - 1].spend - 1;
  near('Costs grow 7% in 2045', g(2045), 0.07, 1e-9);
  near('Costs grow at the eased rate in 2046', g(2046), M.eased(0.07, 2046, E), 1e-9);
  report(g(2090) < 0.021 && g(2090) > 0.02, 'By 2090 costs grow just over 2% a year', `${(g(2090) * 100).toFixed(2)}%`);
  // Bitcoin: Bitcoin24 through 2045, then easing; the 2045 price is untouched.
  const c = M.defaultAssumptions().cases.base;
  const a0 = M.pricePath({ model: 'b24', c, startYear: Y0, startPrice: 84000, endYear: YEND });
  const a1 = M.pricePath({ model: 'b24', c, startYear: Y0, startPrice: 84000, endYear: YEND, ease: E });
  report(a1.price2045 === a0.price2045, 'Easing leaves every price through 2045 as Bitcoin24 has it', `${a1.price2045.toFixed(0)} vs ${a0.price2045.toFixed(0)}`);
  const gp = (pp, y) => pp.price[y - Y0] / pp.price[y - Y0 - 1] - 1;
  report(gp(a1, 2090) < 0.021 && gp(a1, 2090) >= 0.02, 'By 2090 bitcoin grows just over 2% a year', `${(gp(a1, 2090) * 100).toFixed(2)}%`);
  let most = 0;
  for (const k of ['bear', 'base', 'bull']) most = Math.max(most, M.pricePath({ model: 'b24', c: M.defaultAssumptions().cases[k], startYear: Y0, startPrice: 84000, endYear: YEND, ease: E }).price[YEND - Y0]);
  for (const m of [0.5, 1, 1.6]) most = Math.max(most, M.pricePath({ model: 'power', mult: m, startYear: Y0, endYear: YEND, ease: E }).price[YEND - Y0]);
  report(most < 1e8, 'No case reaches $100M a coin by 2090', `highest $${(most / 1e6).toFixed(1)}M`);
  report(a1.price[YEND - Y0] < a0.price[YEND - Y0] / 3, 'The base-case 2090 price falls to under a third of the uneased one', `$${(a1.price[YEND - Y0] / 1e6).toFixed(1)}M vs $${(a0.price[YEND - Y0] / 1e6).toFixed(1)}M`);
  const p1 = M.pricePath({ model: 'power', mult: 1, startYear: Y0, endYear: YEND, ease: E }), p0 = M.pricePath({ model: 'power', mult: 1, startYear: Y0, endYear: YEND });
  report(p1.price2045 === p0.price2045 && gp(p1, 2090) < 0.021, 'The power law also eases after 2045', `2090: $${(p1.price[YEND - Y0] / 1e6).toFixed(0)}M vs $${(p0.price[YEND - Y0] / 1e6).toFixed(0)}M uneased`);
}

// ---------- Working years pay their own costs (the simulator's own rule) ----------
console.log('\nWhile you work, your pay covers your costs; any gap comes from savings, then assets');
{
  const W = (o, extra = {}) => { const L = life(o); Object.assign(L.p, { workGap: true }, extra); return { p: L.p, pr: L.pr, r: M.solve(L.p, L.pr.price, SMAX) }; };
  let n = 0, bad = [];
  for (const k of ['bear', 'base', 'bull']) for (const stack of [0, 3, 30, 100]) for (const spend of [5e4, 2e5, 5e5]) {
    const r = W({ case: k, stack, earn: 0, save: 0, spend }).r; n++;
    if (r.s != null && r.s !== Y0) bad.push(`${k}/${stack}/${spend}: ${r.s}`);
  }
  report(bad.length === 0, 'With no pay, the freedom year is now or never', `${n} cases${bad.length ? ': ' + bad.join('; ') : ''}`);
  bad = []; n = 0;
  for (const k of ['bear', 'base', 'bull']) for (const spend of [1e5, 2e5, 4e5]) {
    let prev = Infinity; // the freedom year with less pay
    for (const earn of [0, 5e4, 1e5, 2e5, 4e5, 8e5]) { const s = yr(W({ case: k, stack: 3, earn, spend }).r.s); n++; if (s > prev) bad.push(`${k}/${spend}/${earn}`); prev = s; }
  }
  report(bad.length === 0, 'More pay never makes freedom later', `${n} cases, ${bad.length} violations${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);
  const same = W({ stack: 0.5, assets: 2e5, earn: 3e5, save: 0.25, spend: 1.2e5, inf: 0.05 }), old = life({ stack: 0.5, assets: 2e5, earn: 3e5, save: 0.25, spend: 1.2e5, inf: 0.05 });
  report(same.r.s === old.r.s && Math.abs(same.r.rows[64].net - old.r.rows[64].net) < 1e-6 * Math.abs(old.r.rows[64].net),
    'When your pay always covers your costs, nothing changes', `freedom ${same.r.s} vs ${old.r.s}`);
  report(same.r.s > Y0, '(that case is not free at once)', `freedom ${same.r.s}`);
  const gap = W({ stack: 3, assets: 1e6, earn: 1e5, save: 0, spend: 1.5e5, inf: 0 }), r0 = M.simulate(gap.p, gap.pr.price, 2040).rows[0], base0 = M.simulate(life({ stack: 3, assets: 1e6, earn: 1e5, save: 0, spend: 1.5e5, inf: 0 }).p, gap.pr.price, 2040).rows[0];
  near('A $50K gap in a working year comes out of shares, bonds and cash', (base0.eq + base0.bd + base0.cu) - (r0.eq + r0.bd + r0.cu), 5e4, 1e-9, (v) => '$' + v.toFixed(0));
  const never = W({ stack: 1, earn: 0, save: 0, spend: 3e5 });
  const stopNow = M.simulate(never.p, never.pr.price, Y0);
  report(never.r.s == null && stopNow.failYear > Y0 && stopNow.failYear <= YEND, 'Never free: the model reports the year the money would run out', `runs out in ${stopNow.failYear}`);
}

// ---------- Four-year cycles (the simulator's own volatility) ----------
console.log('\nFour-year cycles');
{
  const A = M.defaultAssumptions(), E = A.ease, c = A.cases.base;
  const flat = M.pricePath({ model: 'b24', c, startYear: Y0, startPrice: 84000, endYear: YEND, ease: E });
  const zero = M.pricePath({ model: 'b24', c, startYear: Y0, startPrice: 84000, endYear: YEND, ease: E, cycle: { depth: 0 } });
  report(zero.price.every((v, i) => v === flat.price[i]), 'A 0% cycle leaves every price as it was', '');
  const cy = M.pricePath({ model: 'b24', c, startYear: Y0, startPrice: 84000, endYear: YEND, ease: E, cycle: { depth: 0.75 } });
  const rel = (y) => cy.price[y - Y0] / cy.trend[y - Y0];
  report(cy.price[0] === 84000 && cy.price2045 === flat.price2045, 'Today\'s price and the 2045 trend figures are untouched', `${cy.price[0]}, ${cy.price2045.toFixed(0)}`);
  const px = (y) => cy.price[y - Y0];
  near('From the 2027 high, the price falls 75% in 2028', 1 - px(2028) / px(2027), 0.75, 1e-9);
  near('Each fall is 15% smaller than the one before: 2031 to 2032 falls 63.75%', 1 - px(2032) / px(2031), 0.75 * 0.85, 1e-9);
  near('The high sits as far above the path as the low sits below it', rel(2031) * rel(2032), 1, 1e-9);
  report(rel(2029) === 1 && rel(2030) === 1 && rel(2045) === 1, 'Between cycles, and in 2045, bitcoin is on its path', `${rel(2029)}, ${rel(2045)}`);
  near('By the sixth cycle (2047 to 2048) the fall is 0.75 x 0.85^5', 1 - px(2048) / px(2047), 0.75 * Math.pow(0.85, 5), 1e-9);
  // A loan near its cap in a deep cycle gets liquidated; a small one lives.
  // Borrowing from now against a stack, with no pay; stack, costs, cap, loan rate and crash depth vary.
  const B = ({ stack = 5, spend = 1e5, cap = 0.6, rate = 0.1, depth = 0, k = 'base' }) => {
    const L = life({ stack, assets: 0, earn: 0, save: 0, spend, inf: 0.03 });
    Object.assign(L.p, { path: 'borrow', basis: 20000, cgt: 0.25, borrow: { rate, maxLtv: cap, liqLtv: 0.8 }, ease: E, workGap: true });
    const pp = M.pricePath({ model: 'b24', c: A.cases[k], startYear: Y0, startPrice: 84000, endYear: YEND, ease: E, cycle: { depth } });
    return M.simulate(L.p, pp.price, Y0);
  };
  const big = B({ spend: 2.5e5, depth: 0.8 }), calm = B({ spend: 2.5e5, depth: 0 }), small = B({ spend: 2.5e5, cap: 0.1, depth: 0.8 });
  report(big.failReason === 'liquidated', 'A loan at a 60% cap in an 80% crash is liquidated', `${big.failReason} in ${big.failYear}`);
  report(calm.failReason !== 'liquidated', 'The same loan with no crash is not liquidated', `${calm.failReason || 'lasts to 2090'}`);
  report(small.failReason !== 'liquidated', 'A loan held to a 10% cap survives the 80% crash', `${small.failReason || 'lasts to 2090'}`);
  const f0 = B({ stack: 20, spend: 2e5, cap: 0.3, depth: 0, k: 'bear' }), f1 = B({ stack: 20, spend: 2e5, cap: 0.3, depth: 0.5, k: 'bear' });
  report(f1.failYear < f0.failYear, 'In the Bear case, 50% crashes make a borrower run out sooner',
    `runs out ${f1.failYear} vs ${f0.failYear}; forced sales ${f1.forced.toFixed(2)} vs ${f0.forced.toFixed(2)} BTC`);
}

// ---------- Bitcoin-backed credit gets cheaper as bitcoin matures ----------
console.log('\nLoan and STRC rates move toward the mortgage rate');
{
  near('A 10% loan rate is 10% today', M.toward(0.10, 0.05, 2050, 2026, 2026), 0.10, 1e-12);
  near('Halfway to 2050 (2038) it is 7.5%', M.toward(0.10, 0.05, 2050, 2038, 2026), 0.075, 1e-12);
  near('In 2050 it is the 5% mortgage rate, and it stays there', M.toward(0.10, 0.05, 2050, 2060, 2026), 0.05, 1e-12);
  report(M.toward(0.10, null, 2050, 2040, 2026) === 0.10, 'Without an end rate, the rate stays as given', '');
  // In a borrow run the loan grows at the year's rate: check a year with no new borrowing and no sales.
  const L = life({ stack: 100, assets: 0, earn: 0, save: 0, spend: 1e5, inf: 0, strat: 0 });
  Object.assign(L.p, { endYear: 2050, path: 'borrow', basis: 20000, cgt: 0.25, borrow: { rate: 0.10, rateEnd: 0.05, rateYear: 2050, maxLtv: 0.3, liqLtv: 0.8 }, workGap: true });
  const pr = M.pricePath({ model: 'b24', c: M.defaultAssumptions().cases.base, startYear: Y0, startPrice: 84000, endYear: 2050 });
  const rr = M.simulate(L.p, pr.price, Y0).rows, y = 2038, q = rr[y - Y0], q0 = rr[y - Y0 - 1];
  near('The loan grows at 7.5% in 2038, plus that year\'s new borrowing', q.loan - q0.loan * 1.075, 1e5, 1e-6, (v) => '$' + v.toFixed(0));
  // STRC: the dividend follows the same line.
  const S = life({ stack: 10, assets: 0, earn: 0, save: 0, spend: 0, inf: 0 });
  Object.assign(S.p, { endYear: 2050, path: 'strc', basis: 1e12, cgt: 0, strc: { share: 1, rate: 0.12, rateEnd: 0.05, rateYear: 2050, roc: true } });
  const sp = M.pricePath({ model: 'b24', c: M.defaultAssumptions().cases.base, startYear: Y0, startPrice: 84000, endYear: 2050 });
  const sr = M.simulate(S.p, sp.price, Y0).rows;
  near('STRC pays 12% in 2026', sr[0].income / sr[0].strc, 0.12, 1e-9);
  near('and 8.5% in 2038', sr[12].income / sr[12].strc, 0.085, 1e-9);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
