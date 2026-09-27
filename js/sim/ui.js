// The Sovereignty simulator on the page: controls, results, and the "Your sunrise" scene.
// The model is js/sim/model.js: Bitcoin24, plus this simulator's tax, borrowing and STRC paths.
import * as M from './model.js';
import { createSunrise } from './scene.js';

const Y0 = 2026, YEND = 2050, SMAX = YEND - 1, H45 = M.B24.horizon; // the plan ends in 2050; later years are guesswork
const $ = (id) => document.getElementById(id);
const CASES = { bear: { name: 'Bear', mult: 0.5, pl: 'half of trend' }, base: { name: 'Base', mult: 1, pl: 'power-law trend' }, bull: { name: 'Bull', mult: 1.6, pl: '1.6× trend' } };
const PATHS = { sell: 'Selling bitcoin', borrow: 'Borrowing against it', strc: 'Swapping some for STRC' };
const state = { model: 'b24', caseKey: 'base', strat: 2, path: 'sell', saveOverride: null, price: 0, priceSource: 'model', live: 'pending',
  stack: 3, basis: 30000, cgt: 0.25, asm: M.defaultAssumptions() };
const el = { assets: $('sAssets'), earn: $('sEarn'), save: $('sSave'), spend: $('sSpend'), inf: $('sInf'), vol: $('sVol'),
  rate: $('sRate'), ltv: $('sLtv'), liq: $('sLiq'), share: $('sShare'), div: $('sDiv') };
const btcFrom = (v) => (v <= 0 ? 0 : 0.1 * Math.pow(21000, v / 1000)); // 0.1 to 2,100 BTC
const btcTo = (b) => (b <= 0 ? 0 : Math.min(1000, Math.max(1, 1000 * Math.log(b / 0.1) / Math.log(21000))));
const assetsFrom = (v) => (v <= 0 ? 0 : 1e4 * Math.pow(10, 4 * v / 1000));
const earnFrom = (v) => (v <= 0 ? 0 : 2e4 * Math.pow(10, 2 * v / 1000));
const spendFrom = (v) => 30000 * Math.pow(10, 1.5229 * v / 1000);
const basisFrom = (v) => (v <= 0 ? 0 : 100 * Math.pow(10, 4 * v / 1000)); // $100 to $1M per bitcoin
const basisTo = (b) => (b <= 0 ? 0 : Math.min(1000, Math.max(1, 250 * Math.log10(b / 100))));
const nice = (v) => { if (v <= 0) return 0; const f = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / f) * f; };
// A typed amount: digits with an optional decimal point; money may end in k, m or b (65k = 65,000). Anything else is NaN.
const parse = (s, money) => {
  const m = s.trim().toLowerCase().replace(/[$,%\s]/g, '').match(/^(\d+(?:\.\d*)?|\.\d+)([kmb]?)$/);
  if (!m || (m[2] && !money)) return NaN;
  const v = parseFloat(m[1]) * { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2]];
  return v < 1e13 ? v : NaN;
};

function money(v) {
  if (v < 0) return '−' + money(-v);
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(v >= 1e10 ? 0 : 1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
  if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
  return '$' + Math.round(v);
}
function big(v) {
  if (!isFinite(v)) return '—';
  const neg = v < 0; let a = Math.abs(v);
  if (a > 0) { const f = Math.pow(10, Math.floor(Math.log10(a)) - 2); a = Math.round(a / f) * f; }
  const u = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, ''];
  const x = a / u[0];
  return (neg ? '−$' : '$') + String(+x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)) + u[1];
}
const pct = (x) => { const p = x * 100; return String(+p.toFixed(Math.abs(p) >= 10 ? 1 : 2)) + '%'; };
const num = (x, d) => String(+(x * 100).toFixed(d));
const btcFmt = (b) => (b <= 0 ? '0 BTC' : b < 0.01 ? Math.round(b * 1e8).toLocaleString('en-US') + ' sats' : (b < 10 ? b.toFixed(2) : b < 1000 ? b.toFixed(1) : Math.round(b).toLocaleString('en-US')) + ' BTC');
const yearWord = (s) => (s == null ? 'Not yet' : s === Y0 ? 'Now' : String(s));
const currentCase = () => state.asm.cases[state.caseKey];

function paramsFor(i, path = state.path) {
  const st = M.STRATEGIES[i], a = state.asm;
  return { startYear: Y0, endYear: YEND, stack: state.stack, assets: assetsFrom(+el.assets.value), earnings: earnFrom(+el.earn.value),
    save: state.saveOverride != null ? state.saveOverride : st.save, strategy: st, mix: a.mix, returns: a.returns, tax: a.incomeTax,
    earningsGrowth: a.earningsGrowth, mortgageShare: a.mortgageShare, mortgageRate: a.mortgageRate,
    spend: spendFrom(+el.spend.value), inflation: +el.inf.value / 100,
    basis: state.basis, cgt: state.cgt, path,
    borrow: { rate: +el.rate.value / 100, rateEnd: a.mortgageRate, rateYear: YEND, maxLtv: +el.ltv.value / 100, liqLtv: +el.liq.value / 100 },
    strc: { share: +el.share.value / 100, rate: +el.div.value / 100, rateEnd: a.mortgageRate, rateYear: YEND, roc: $('sRoc').checked }, ease: a.ease, workGap: true };
}
function pricesNow() {
  return M.pricePath(state.model === 'power'
    ? { model: 'power', mult: CASES[state.caseKey].mult, startYear: Y0, endYear: YEND, ease: state.asm.ease, cycle: { depth: +el.vol.value / 100 } }
    : { model: 'b24', c: currentCase(), startYear: Y0, startPrice: state.price, endYear: YEND, ease: state.asm.ease, cycle: { depth: +el.vol.value / 100 } });
}

const fill = (input) => input.style.setProperty('--p', ((input.value - input.min) / (input.max - input.min)) * 100 + '%');
const press = (sel, on) => document.querySelectorAll(sel + ' button').forEach((b) => b.setAttribute('aria-pressed', String(on(b))));
const fit = (input) => { input.style.width = Math.max(4, input.value.length + 0.6) + 'ch'; };
function stratText(st) {
  if (!st.convert && !st.excess) return 'Normie keeps what you own as it is. Your savings go into shares, bonds and cash.';
  const part = (v) => (v >= 1 ? 'all' : Math.round(v * 100) + '%');
  let t = `${st.name} moves ${part(st.convert)} of your shares, bonds and cash into bitcoin today`;
  if (st.extraMortgage) t += `, plus a new loan of ${Math.round(st.extraMortgage * 100)}% of your real estate's value`;
  return t + `. ${st.excess >= 1 ? 'All' : part(st.excess)} of your savings buy bitcoin each year.`;
}
function syncStrategy() {
  const st = M.STRATEGIES[state.strat], d = Math.round(st.save * 100);
  press('#simStrats', (b) => +b.dataset.strat === state.strat);
  $('stratHint').textContent = stratText(st);
  if (state.saveOverride == null) {
    el.save.value = d; $('saveHintText').textContent = `Bitcoin24's default for ${st.name}. Invested every year from ${Y0 + 1} until you're free. If your costs need more than the rest of your pay, the gap comes out of these savings first, then out of what you own.`; $('saveReset').hidden = true;
  } else {
    el.save.value = Math.round(state.saveOverride * 100);
    $('saveHintText').textContent = `Your choice. Bitcoin24's ${st.name} saves ${d}%.`;
    $('saveReset').textContent = `Use ${d}%`; $('saveReset').hidden = false;
  }
}

// Typed fields: bitcoin's price today, your cost basis, your tax rate.
const px = $('simPx'), btcIn = $('oBtc'), basisIn = $('oBasis'), cgtIn = $('oCgt');
function showBtc() { btcIn.value = (+state.stack.toPrecision(6)).toLocaleString('en-US', { maximumFractionDigits: 8 }) + ' BTC'; fit(btcIn); }
function showPrice() { px.value = '$' + state.price.toLocaleString('en-US', { maximumFractionDigits: state.price < 100 ? 2 : 0 }); fit(px); }
function showBasis() { basisIn.value = '$' + Math.round(state.basis).toLocaleString('en-US'); fit(basisIn); }
function showCgt() { cgtIn.value = String(+(state.cgt * 100).toFixed(2)) + '%'; fit(cgtIn); }
function priceHint(bad) {
  const h = $('pxHint'), cs = CASES[state.caseKey];
  px.disabled = state.model === 'power';
  if (state.model === 'power') { h.textContent = `Not used by the power law. Its 2026 price on the ${cs.name} path is ${big(M.powerLaw(Y0) * cs.mult)}.`; return; }
  if (bad) { h.textContent = 'Type a price above $0, like 110000 or 110k.'; return; }
  if (state.priceSource === 'live') h.textContent = 'Live price from mempool.space. Edit it if you like.';
  else if (state.priceSource === 'user') h.textContent = 'Your price.';
  else h.textContent = `Bitcoin24 model value for 2026, ${cs.name} case. ` + (state.live === 'pending' ? 'Checking the live price…' : 'Edit it to match the market.');
}
function useModelPrice() { state.price = Math.round(M.modelPrice(currentCase(), Y0)); showPrice(); }
function syncCases() {
  press('#simModels', (b) => b.dataset.model === state.model);
  press('#simCases', (b) => b.dataset.case === state.caseKey);
  for (const k in CASES) { const c = state.asm.cases[k]; $('c' + k).textContent = state.model === 'power' ? CASES[k].pl : `${pct(c.arr)} → ${pct(c.floor)}`; }
  const c = currentCase();
  $('caseHint').textContent = state.model === 'power'
    ? `Each path is a multiple of the power-law trend, every year to ${YEND}.`
    : `${CASES[state.caseKey].name}: ${pct(c.arr)} a year in 2025, ${num(c.red, 2)} points lower each year, never below ${pct(c.floor)}. After 2045, growth with world assets, easing toward ${pct(state.asm.ease.floor)}.`;
  $('asmCase').textContent = CASES[state.caseKey].name;
}
function syncPath() {
  press('#simPaths', (b) => b.dataset.path === state.path);
  for (const k in PATHS) $('panel-' + k).hidden = k !== state.path;
}

const ASM = [
  ['aArr', (a) => a.cases[state.caseKey].arr, (a, v) => { a.cases[state.caseKey].arr = v; }, 2],
  ['aRed', (a) => a.cases[state.caseKey].red, (a, v) => { a.cases[state.caseKey].red = v; }, 2],
  ['aFloor', (a) => a.cases[state.caseKey].floor, (a, v) => { a.cases[state.caseKey].floor = v; }, 2],
  ['mEq', (a) => a.mix.equity, (a, v) => { a.mix.equity = v; }, 2],
  ['mRe', (a) => a.mix.realEstate, (a, v) => { a.mix.realEstate = v; }, 2],
  ['mBd', (a) => a.mix.bonds, (a, v) => { a.mix.bonds = v; }, 2],
  ['mCu', (a) => a.mix.currency, (a, v) => { a.mix.currency = v; }, 2],
  ['rEq', (a) => a.returns.equity, (a, v) => { a.returns.equity = v; }, 'f2'],
  ['rRe', (a) => a.returns.realEstate, (a, v) => { a.returns.realEstate = v; }, 'f2'],
  ['rBd', (a) => a.returns.bonds, (a, v) => { a.returns.bonds = v; }, 'f2'],
  ['rCu', (a) => a.returns.currency, (a, v) => { a.returns.currency = v; }, 'f2'],
  ['aTax', (a) => a.incomeTax, (a, v) => { a.incomeTax = v; }, 2],
  ['aGrow', (a) => a.earningsGrowth, (a, v) => { a.earningsGrowth = v; }, 2],
  ['aMort', (a) => a.mortgageShare, (a, v) => { a.mortgageShare = v; }, 2],
  ['aRate', (a) => a.mortgageRate, (a, v) => { a.mortgageRate = v; }, 2],
  ['eAfter', (a) => a.ease.after, (a, v) => { a.ease.after = Math.round(v); }, 'raw'],
  ['eFloor', (a) => a.ease.floor, (a, v) => { a.ease.floor = v; }, 2],
  ['eHalf', (a) => a.ease.halfLife, (a, v) => { a.ease.halfLife = v; }, 'raw'],
];
function syncAssumptions() {
  for (const [id, get, , d] of ASM) { const v = get(state.asm); $(id).value = d === 'raw' ? String(+v.toFixed(2)) : d === 'f2' ? (v * 100).toFixed(2) : num(v, d); }
  syncMixTotal();
}
function syncMixTotal() {
  const m = state.asm.mix, t = Math.round((m.equity + m.realEstate + m.bonds + m.currency) * 1e4) / 100, h = $('mixTotal');
  const ok = Math.abs(t - 100) < 0.01;
  h.textContent = ok ? 'Adds to 100%.' : t > 0 ? `Adds to ${t}%. The model scales the mix to 100%.` : 'Adds to 0%. The model then holds it all as cash.';
  h.classList.toggle('warn', !ok);
}

// A round number at or above v for the top of the chart: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten.
function roundTop(v) {
  if (!(v > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => k >= f - 1e-9) * e;
}
const tick = (v) => (v === 0 ? '0' : (+v.toPrecision(3)).toLocaleString('en-US'));
// Bitcoin you own each year, net of any loan: an area from 2026 to the end year with your freedom year marked.
// s: freedom year, or null. runOut: when never free, the year the money would run out if you stopped now.
function chart(rows, s, runOut, liquidated) {
  const v = rows.map((q) => Math.max(0, q.btc - (q.loan > 0 ? q.loan / q.price : 0)));
  const max = Math.max(...v), top = roundTop(max), n = v.length - 1;
  const svg = $('chartLine').ownerSVGElement;
  if (svg.getAttribute('viewBox') !== `0 0 ${n} 100`) { svg.setAttribute('viewBox', `0 0 ${n} 100`); svg.querySelector('.c-grid').setAttribute('x2', n); }
  $('yTop').textContent = tick(top); $('yMid').textContent = tick(top / 2);
  const pts = v.map((x, i) => `${i},${(100 - (x / top) * 100).toFixed(2)}`).join('L');
  $('chartLine').setAttribute('d', 'M' + pts);
  $('chartArea').setAttribute('d', `M0,100L${pts}L${n},100Z`);
  const line = $('chartFree'), label = $('chartFreeLabel');
  const mark = s != null ? s : runOut;
  line.style.display = mark == null ? 'none' : '';
  label.hidden = mark == null;
  if (mark != null) {
    const x = mark - Y0, f = x / n;
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    label.textContent = s == null ? `${liquidated ? 'Liquidated' : 'Runs out'} ${runOut}` : s === Y0 ? 'Free now' : `Free ${s}`;
    label.style.left = f * 100 + '%';
    label.style.transform = f < 0.12 ? 'translateX(4px)' : f > 0.88 ? 'translateX(calc(-100% - 4px))' : 'translateX(-50%)';
  }
  $('chartMax').textContent = 'Peak ' + btcFmt(max);
  if ($('simMath').open) mathTable(rows, s, runOut);
  $('chartBox').setAttribute('aria-label', `Bitcoin you own, net of any loan: ${btcFmt(v[0])} in ${Y0}, peak ${btcFmt(max)}, ${btcFmt(v[n])} in ${YEND}.`);
}

// The year-by-year math behind the chart, drawn only while it is open.
const coins = (b) => { const a = Math.abs(b); return a < 0.0005 ? '0' : a >= 100 ? b.toFixed(1) : a >= 1 ? b.toFixed(2) : b.toFixed(3); };
function mathTable(rows, s, runOut) {
  let prevTax = 0, html = '';
  for (const q of rows) {
    const flow = q.bought - q.sold, tax = q.taxBtc - prevTax, left = Math.max(0, q.btc - (q.loan > 0 ? q.loan / q.price : 0));
    prevTax = q.taxBtc;
    const work = s != null && q.y < s, tag = q.y === s ? ' free' : q.y === runOut ? ' runs out' : work ? ' working' : '';
    const cls = q.y === s ? 'free' : q.y === runOut ? 'out' : work ? 'work' : '';
    html += `<tr${cls ? ` class="${cls}"` : ''}><td>${q.y}<small>${tag}</small></td><td>${big(q.price)}</td><td>${big(q.spend)}</td>`
      + `<td>${flow > 0 ? '+' : flow < 0 ? '−' : ''}${coins(Math.abs(flow))}</td><td>${coins(tax)}</td>`
      + (state.path === 'borrow' ? `<td>${q.loan > 0 ? big(q.loan) + ' · ' + Math.round(Math.min(q.ltv, 9.99) * 100) + '%' : '—'}</td>` : '')
      + (state.path === 'strc' ? `<td>${q.income > 0 ? big(q.income) : '—'}</td>` : '')
      + `<td>${coins(left)}</td></tr>`;
  }
  $('mathRows').innerHTML = html;
  $('thLoan').hidden = state.path !== 'borrow';
  $('thDiv').hidden = state.path !== 'strc';
  const note = { sell: 'Bitcoin sold covers what shares, bonds and cash cannot, plus the tax on the sale.',
    borrow: 'Bitcoin left is net of the loan. Sales happen only when the loan reaches your cap.',
    strc: 'STRC\'s dividend pays your costs first, so it cuts the bitcoin you sell. In your freedom year, bitcoin sold includes the coins swapped for STRC.' }[state.path];
  const lead = s == null ? 'You are not free by ' + SMAX + ', so this shows what would happen if you stopped now.' : 'Working years are grey: your pay covers your costs, and any gap shows as bitcoin sold.';
  $('mathNote').textContent = `${lead} Dollars are dollars of each year. Your costs grow at your inflation rate and ease after ${state.asm.ease.after}, and so does bitcoin's growth. ${note}`;
}

// Warning zone: numbers that should make you look twice turn red, and each rule adds its reason under the results.
const RED = ['oLtv', 'oLiq', 'oRate', 'oDiv', 'rA', 'rB'];
function warnings(p, pp, r, s, o) {
  const red = new Set(), why = [], start = o[0].btc, borrowing = state.path === 'borrow';
  if (borrowing) {
    const cap = p.borrow.maxLtv, liq = p.borrow.liqLtv, room = 1 - cap / liq;
    if (cap >= liq) { red.add('oLtv'); red.add('oLiq'); why.push('Your cap is at or above the level where the lender sells, so a loan that reaches your cap is liquidated.'); }
    else if (room < 0.77) { red.add('oLtv'); why.push(`A loan at your cap survives only a ${Math.floor(room * 100)}% fall in bitcoin's price. Bitcoin fell 77% from its 2021 high to its 2022 low.`); }
    if (r.peakLtv > 0 && r.crashMargin < 0.77) {
      red.add('rB');
      if (!red.has('oLtv')) why.push(`At its riskiest, your loan survives only a ${Math.floor(r.crashMargin * 100 + 1e-9)}% fall in bitcoin's price. Bitcoin fell 77% from its 2021 high to its 2022 low.`);
    }
    if (r.forced > 0.1 * start) { red.add('rA'); why.push(`You sell ${btcFmt(r.forced)} to keep the loan under your cap, more than a tenth of your bitcoin.`); }
    // The loan compounds at its rate; from the first free year the smooth price grows slower than that, the loan outgrows the bitcoin.
    for (let i = 1; i < o.length; i++) {
      const rate = M.toward(p.borrow.rate, p.borrow.rateEnd, p.borrow.rateYear, o[i].y, Y0);
      if (o[i].y > YEND - 3) break; // a year or two at the very end is not a pattern worth a warning
      if (o[i].loan > 0 && pp.trend[i] / pp.trend[i - 1] - 1 < rate) {
        red.add('oRate');
        why.push(`From ${o[i].y}, your loan's ${pct(rate)} interest is more than bitcoin's growth, so the loan grows faster than your bitcoin and you sell some every year to stay under your cap.`);
        break;
      }
    }
    if (s == null && r.failReason === 'liquidated') why.push(`In ${r.failYear}, a crash pushes the loan past the lender's ${pct(liq)} of your bitcoin's value, and the lender sells.`);
  }
  if (state.path === 'strc' && p.strc.rate > 0.12) { red.add('oDiv'); why.push('A dividend above 12% today is more than STRC had paid by September 2026.'); }
  for (const id of RED) $(id).classList.toggle('warn', red.has(id));
  const list = $('simWarn'), html = why.map((t) => `<li>${t}</li>`).join('');
  if (list.innerHTML !== html) list.innerHTML = html;
}

let sunrise = null;
function update() {
  const pp = pricesNow(), solveFor = (i, path) => M.solve(paramsFor(i, path), pp.price, SMAX);
  const p = paramsFor(state.strat), r0 = M.solve(p, pp.price, SMAX), s = r0.s, yrs = s == null ? null : s - Y0;
  const r = s == null ? Object.assign({ s: null }, M.simulate(p, pp.price, Y0)) : r0; // never free: what stopping now would do
  const o = r.rows, runOut = s == null ? r.failYear : null;
  $('oAssets').textContent = p.assets ? money(p.assets) : 'Nothing';
  $('oEarn').textContent = p.earnings ? money(p.earnings) : 'Nothing';
  $('oSave').textContent = Math.round(p.save * 100) + '%';
  $('oSpend').textContent = money(p.spend);
  $('oInf').textContent = el.inf.value + '%';
  $('oRate').textContent = el.rate.value + '%';
  $('oLtv').textContent = el.ltv.value + '%';
  $('oLiq').textContent = el.liq.value + '%';
  $('oShare').textContent = el.share.value + '%';
  $('oDiv').textContent = String(+(+el.div.value).toFixed(2)) + '%';
  $('oVol').textContent = +el.vol.value ? el.vol.value + '%' : 'None';
  [...Object.values(el), $('sBtc'), $('sBasis'), $('sCgt')].forEach(fill);

  const noPay = !(p.earnings > 0), liquidated = s == null && r.failReason === 'liquidated';
  const ends = liquidated ? `in ${runOut} a crash would push your loan past the lender's limit, and the lender would sell your bitcoin` : `what you own would run out in ${runOut}`;
  const verdict = s == null ? (noPay && runOut ? `With no pay, you live on what you own from now, and ${ends}. Spend less, or try another path.`
      : runOut ? `Not by ${SMAX}. If you stopped now, ${ends}. Spend less, earn more, or try another path.` : `Not by ${SMAX}. Life outruns what you own. Spend less, earn more, or try another path.`)
    : s === Y0 ? `You could stop today. What you own pays for your life through ${YEND}.`
      : `Free in ${s}, ${yrs} year${yrs > 1 ? 's' : ''} from now. What you own then pays for your life through ${YEND}.`;
  if ($('simVerdict').textContent !== verdict) $('simVerdict').textContent = verdict; // a live region: speak only real changes
  $('sBtc').setAttribute('aria-valuetext', btcFmt(state.stack));
  for (const [input, out] of [[el.assets, 'oAssets'], [el.earn, 'oEarn'], [el.save, 'oSave'], [el.spend, 'oSpend'], [el.inf, 'oInf'],
    [el.rate, 'oRate'], [el.ltv, 'oLtv'], [el.liq, 'oLiq'], [el.share, 'oShare'], [el.div, 'oDiv'], [el.vol, 'oVol']]) input.setAttribute('aria-valuetext', $(out).textContent);
  $('sBasis').setAttribute('aria-valuetext', '$' + Math.round(state.basis).toLocaleString('en-US')); $('sCgt').setAttribute('aria-valuetext', String(+(state.cgt * 100).toFixed(2)) + '%');
  const E = state.asm.ease;
  $('infHint').textContent = `How fast your costs rise each year, not the CPI. Your rate holds through ${E.after}, then eases toward ${pct(E.floor)}: the gap halves every ${+E.halfLife.toFixed(1)} years. Bitcoin24 assumes 6% monetary inflation and 2% CPI.`;
  $('ltvHint').textContent = 'You borrow for your costs until the loan reaches this share of your bitcoin\'s value. Past it, you sell bitcoin to bring the loan back down.';
  $('simYearBig').textContent = yearWord(s);
  $('pinYear').textContent = s == null ? (runOut ? `${liquidated ? 'Liquidated' : 'Runs out'} in ${runOut}` : `Not by ${SMAX}`) : s === Y0 ? 'Free now' : `Free in ${s}`;
  $('pinPath').textContent = PATHS[state.path];
  $('advNow').textContent = PATHS[state.path];
  if (sunrise) sunrise.show(s, yrs);

  const end = o[YEND - Y0], at = s == null ? null : o[s - Y0], before = s != null && s > Y0 ? o[s - Y0 - 1] : null;
  $('rToday').textContent = big(r.netStart);
  $('r2045').textContent = big(o[H45 - Y0].net);
  $('rPx').textContent = big(pp.price2045);
  $('rShare').textContent = pct(pp.share2045);
  $('rTax').textContent = btcFmt(r.taxBtc);
  $('r2090').textContent = btcFmt(Math.max(0, end.btc - end.loan / end.price));
  let A, B;
  if (state.path === 'borrow') {
    A = [`Bitcoin sold to stay under your cap, through ${YEND}`, btcFmt(r.forced)];
    B = ['Price fall your loan can take at its riskiest', r.peakLtv > 0 ? Math.floor(r.crashMargin * 100 + 1e-9) + '%' : 'No loan'];
  } else if (state.path === 'strc') {
    A = ['Put into STRC in your freedom year, after tax', at && at.strc > 0 ? big(at.strc) : '—'];
    const divAt = s == null ? p.strc.rate : M.toward(p.strc.rate, p.strc.rateEnd, p.strc.rateYear, s, Y0); // the rate falls toward the mortgage rate
    B = [`STRC dividends in your first free year, at ${pct(divAt)}`, at && at.strc > 0 ? big(at.strc * divAt) : '—'];
  } else {
    A = ['Bitcoin sold in your first free year', at ? btcFmt(at.sold) : '—'];
    B = ['Of that, sold to pay the tax', at ? btcFmt(at.taxBtc - (before ? before.taxBtc : 0)) : '—'];
  }
  $('rALabel').textContent = A[0]; $('rA').textContent = A[1];
  $('rBLabel').textContent = B[0]; $('rB').textContent = B[1];
  chart(o, s, runOut, liquidated);
  warnings(p, pp, r, s, o);
  $('trendToday').textContent = money(M.powerLaw(Y0));

  document.querySelectorAll('#simStrats button').forEach((b) => { const i = +b.dataset.strat; b.querySelector('b').textContent = yearWord(i === state.strat ? s : solveFor(i).s); });
  document.querySelectorAll('#simPaths button').forEach((b) => { const k = b.dataset.path; b.querySelector('b').textContent = yearWord(k === state.path ? s : solveFor(state.strat, k).s); });
}

function init() {
  Object.values(el).forEach((i) => i.addEventListener('input', () => {
    if (i === el.save) { state.saveOverride = +el.save.value / 100; syncStrategy(); }
    update();
  }));
  $('sRoc').addEventListener('change', update);
  $('simMath').addEventListener('toggle', () => { if ($('simMath').open) update(); });
  $('sBtc').addEventListener('input', () => { state.stack = nice(btcFrom(+$('sBtc').value)); showBtc(); update(); });
  $('sBasis').addEventListener('input', () => { state.basis = nice(basisFrom(+$('sBasis').value)); showBasis(); update(); });
  $('sCgt').addEventListener('input', () => { state.cgt = +$('sCgt').value / 100; showCgt(); update(); });
  const bad = (input, isBad) => { input.classList.toggle('bad', isBad); input.setAttribute('aria-invalid', String(isBad)); return isBad; };
  btcIn.addEventListener('input', () => {
    fit(btcIn);
    const v = parse(btcIn.value.replace(/btc/i, ''), false); if (bad(btcIn, !(v >= 0 && v <= 21e6))) return;
    state.stack = v; $('sBtc').value = btcTo(v); update();
  });
  btcIn.addEventListener('change', () => { bad(btcIn, false); showBtc(); });
  basisIn.addEventListener('input', () => {
    fit(basisIn);
    const v = parse(basisIn.value, true); if (bad(basisIn, !(v >= 0))) return;
    state.basis = v; $('sBasis').value = basisTo(v); update();
  });
  basisIn.addEventListener('change', () => { bad(basisIn, false); showBasis(); });
  cgtIn.addEventListener('input', () => {
    fit(cgtIn);
    const v = parse(cgtIn.value, false); if (bad(cgtIn, !(v >= 0 && v <= 100))) return;
    state.cgt = v / 100; $('sCgt').value = Math.min(60, v); update();
  });
  cgtIn.addEventListener('change', () => { bad(cgtIn, false); showCgt(); });
  document.querySelectorAll('#simStrats button').forEach((b) => b.addEventListener('click', () => { state.strat = +b.dataset.strat; syncStrategy(); update(); }));
  document.querySelectorAll('#simPaths button').forEach((b) => b.addEventListener('click', () => { state.path = b.dataset.path; syncPath(); update(); }));
  $('saveReset').addEventListener('click', () => { state.saveOverride = null; syncStrategy(); update(); el.save.focus(); });
  document.querySelectorAll('#simModels button').forEach((b) => b.addEventListener('click', () => { state.model = b.dataset.model; syncCases(); priceHint(); update(); }));
  document.querySelectorAll('#simCases button').forEach((b) => b.addEventListener('click', () => {
    state.caseKey = b.dataset.case; if (state.priceSource === 'model') useModelPrice();
    syncCases(); syncAssumptions(); priceHint(); update();
  }));
  px.addEventListener('input', () => {
    fit(px);
    const v = parse(px.value, true);
    if (bad(px, !(v > 0))) { priceHint(true); return; }
    state.price = v; state.priceSource = 'user'; priceHint(); update();
  });
  px.addEventListener('change', () => { bad(px, false); showPrice(); priceHint(); });
  for (const [id, , set, d] of ASM) {
    const inp = $(id);
    inp.addEventListener('input', () => {
      let v = parseFloat(inp.value); if (!isFinite(v)) return;
      v = Math.min(+inp.max, Math.max(+inp.min, v));
      set(state.asm, d === 'raw' ? v : v / 100); syncMixTotal();
      if (state.priceSource === 'model' && ['aArr', 'aRed', 'aFloor'].includes(id)) useModelPrice();
      syncCases(); update();
    });
    inp.addEventListener('change', () => syncAssumptions());
  }
  $('asmReset').addEventListener('click', () => {
    state.asm = M.defaultAssumptions(); if (state.priceSource === 'model') useModelPrice();
    syncAssumptions(); syncCases(); priceHint(); update();
  });

  const grid = document.querySelector('.sim-grid'), view = document.querySelector('.sim-view');
  const pin = () => grid.classList.toggle('pinned', window.innerWidth >= 960 && view.offsetHeight + 32 <= window.innerHeight);
  new ResizeObserver(pin).observe(view);
  window.addEventListener('resize', pin);

  useModelPrice(); showBtc(); showBasis(); showCgt(); syncStrategy(); syncCases(); syncPath(); syncAssumptions(); priceHint(); update(); pin();
  fetchLive();
  startScene();
}

function fetchLive() {
  if (!window.fetch || !window.AbortController) { state.live = 'failed'; priceHint(); return; }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 3000);
  fetch('https://mempool.space/api/v1/prices', { signal: ctl.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((j) => {
      const usd = +(j && j.USD); if (!(usd > 0)) throw new Error('No USD price');
      state.live = 'ok';
      if (state.priceSource === 'model') { state.price = usd; state.priceSource = 'live'; showPrice(); priceHint(); update(); } else priceHint();
    })
    .catch(() => { state.live = 'failed'; priceHint(); })
    .finally(() => clearTimeout(timer));
}

// The scene is built when the section comes near (so it never slows the rest of the page as it loads),
// and draws only while it is on screen and the tab is visible.
function startScene() {
  const box = $('simScene');
  const near = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    near.disconnect();
    buildScene(box);
  }, { rootMargin: '600px 0px' });
  near.observe(box);
}
async function buildScene(box) {
  try { sunrise = await createSunrise($('simCanvas')); } catch (e) { console.warn('Sunrise scene unavailable:', e); box.classList.add('no-3d'); return; }
  const size = () => sunrise.resize(box.clientWidth, box.clientHeight, Math.min(window.devicePixelRatio || 1, 1.5));
  size();
  window.addEventListener('resize', size);
  update();
  let visible = false;
  const run = () => (visible && !document.hidden ? sunrise.start() : sunrise.stop());
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; run(); }, { threshold: 0.02 }).observe(box);
  document.addEventListener('visibilitychange', run);
  box.classList.add('ready');
  if (new URLSearchParams(location.search).has('debug')) window.__sunrise = sunrise;
}

if (!new URLSearchParams(location.search).has('capture')) init();
