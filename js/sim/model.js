// The Sovereignty simulator's model: pure code, no DOM, shared by the page and by tools/test-sim.mjs.
// Price and macro model: Bitcoin24 v1.0 by Michael Saylor, Shirish Jajodia and Chaitanya Jain
// (github.com/bitcoin-model/bitcoin_model, commit 30c97a7). Cell references in comments.
// Taxes, borrowing and STRC are this simulator's own additions (see simulate()).
export const B24={
  price2024:65000,                                             // BTC!D4, $65K
  cases:{                                                      // BTC!E7:G9
    bear:{arr:.25,red:.005,floor:.18},
    base:{arr:.50,red:.025,floor:.20},
    bull:{arr:.75,red:.05, floor:.25}},
  supplyM:[19.802,19.966,20.13,20.295,20.401,20.484,20.566,20.648,20.701,20.742,20.783,
           20.824,20.85,20.871,20.892,20.912,20.925,20.935,20.946,20.956,20.963,20.968], // Macro!C21:X21, 2024..2045, millions
  world2024T:{gold:16,art:18,equity:115,realEstate:330,bonds:300,currency:120},        // Macro!C23:C28, $T
  inflationGrowth:.06, innovationGrowth:.03, cpi:.02,          // Macro!C7, C8, C42
  monetization:{gold:-.04,art:0,equity:.01,realEstate:-.02,bonds:-.04,currency:-.02}, // Macro!N5:N10
  dilution:{gold:.0175,art:.0125,equity:.01,realEstate:.02},   // Macro!AD5:AD8
  yields:{bonds:.07,currency:.02},                             // Macro!AD11:AD12, pre-tax
  mix:{equity:.30,realEstate:.50,bonds:.15,currency:.05},      // Individual!O5:O8
  assets:1e6, earnings:2e5, earningsGrowth:.05, incomeTax:.40, // Individual!D5, D7, D8, D9
  mortgageShare:.50, mortgageRate:.05,                         // Individual!AE4 (50% of real estate), AE5
  horizon:2045
};
// Individual!E11:Y15: Bitcoin24's five strategies, as in the workbook. convert = share of non-real-estate assets moved
// to BTC in year one, excess = share of excess earnings put into BTC, extraMortgage = new loan as a share of real estate value.
export const B24_STRATEGIES=[
  {name:'Normie',      convert:0,  excess:0,  extraMortgage:0,   save:.25},
  {name:'BTC 10%',     convert:.1, excess:.1, extraMortgage:0,   save:.25},
  {name:'BTC Maxi',    convert:.8, excess:.8, extraMortgage:0,   save:.25},
  {name:'Double Maxi', convert:1,  excess:1,  extraMortgage:.25, save:.25},
  {name:'Triple Maxi', convert:1,  excess:1,  extraMortgage:.5,  save:.5}
];
// The simulator's strategies: the first four of Bitcoin24's, then Double Dipper (the simulator's own): Double Maxi's
// moves, with half of everything it buys going into STRC instead of bitcoin. strc = the share of the converted assets,
// the new loan and the savings that goes into STRC.
export const STRATEGIES=[...B24_STRATEGIES.slice(0,4),
  {name:'Double Dipper', convert:1,  excess:1,  extraMortgage:.25, save:.25, strc:.5}];
const capGrowth=k=>B24.inflationGrowth+B24.innovationGrowth+B24.monetization[k]; // Macro rows 55-60
const impliedReturn=k=>(1+capGrowth(k))/(1+B24.dilution[k])-1;                   // Macro rows 69-72

function defaultAssumptions(){
  const c=B24.cases;
  return {
    cases:{bear:Object.assign({},c.bear),base:Object.assign({},c.base),bull:Object.assign({},c.bull)},
    mix:Object.assign({},B24.mix),
    returns:{equity:impliedReturn('equity'),realEstate:impliedReturn('realEstate'),bonds:B24.yields.bonds,currency:B24.yields.currency},
    incomeTax:B24.incomeTax, earningsGrowth:B24.earningsGrowth, mortgageShare:B24.mortgageShare, mortgageRate:B24.mortgageRate,
    ease:{after:B24.horizon, floor:B24.cpi, halfLife:5}    // the simulator's own: see eased()
  };
}
// The simulator's own long-run rule, not Bitcoin24's: after the year `after`, a yearly growth rate above `floor`
// eases toward it, the gap halving every `halfLife` years. It is used for your inflation and for bitcoin's growth,
// so neither compounds at its early rate forever. ease = null leaves rates as they are.
function eased(rate,year,ease){
  if(!ease||year<=ease.after||!(rate>ease.floor))return rate;
  return ease.floor+(rate-ease.floor)*Math.pow(0.5,(year-ease.after)/ease.halfLife);
}
// Macro row 52: ARR(2025) = 2025 ARR; ARR(y) = MAX(ARR(y-1) - reduction, steady state).
function arrFor(c,year){let a=c.arr;for(let y=2026;y<=year;y++)a=Math.max(a-c.red,c.floor);return a;}
// World assets other than BTC, in $: each class compounds at its own market-cap growth (Macro rows 23-28).
function worldOther(year){let t=0;for(const k in B24.world2024T)t+=B24.world2024T[k]*1e12*Math.pow(1+capGrowth(k),year-2024);return t;}
// BTC supply in coins (Macro row 21); held at the 2045 figure after 2045.
function supply(year){const y=Math.min(Math.max(year,2024),2045);return B24.supplyM[y-2024]*1e6;}
// The power-law trend used by the first version of this simulator.
function powerLaw(year){const d=(Date.UTC(year,8,24)-Date.UTC(2009,0,3))/864e5;return 1.0117e-17*Math.pow(d,5.82);}

// Price per year from startYear to endYear.
// model 'b24': price(startYear) = startPrice, then Bitcoin24's calendar-year ARR through 2045. After 2045
// (the simulator's own extension, not Bitcoin24): BTC grows with the other world assets, so its share stays at the 2045 level.
// model 'power': power-law trend times mult for every year.
// o.ease (optional): after ease.after, each year's growth eases toward ease.floor (see eased()).
// o.cycle (optional, the simulator's own): {depth, shrink}. A four-year cycle around the smooth path: a high one year
// (startYear+1, +5, +9 ...), then in the next year the price falls from that high (crashes are fast), then it is back on
// the path for two years. The first fall is `depth`; each later one is `shrink` times the one before (default 0.85), as
// bitcoin matures. The high sits as far above the path as the low sits below it, so the path's level is unchanged;
// 2045 falls on the path. price2045 and share2045 always come from the smooth path.
function withCycles(trend,y0,cycle,E){
  const cyc=trend.slice();
  if(!cycle||!(cycle.depth>0))return cyc;
  for(let i=0;i+1<trend.length;i++){
    const y=y0+i;
    if((y-y0)%4!==1)continue;                                            // a high year
    const d=Math.min(0.95,cycle.depth)*Math.pow(cycle.shrink??0.85,(y-y0-1)/4);
    const up=Math.sqrt((trend[i+1]/trend[i])/(1-d));                     // above the path at the high, below it at the low
    cyc[i]=trend[i]*up;cyc[i+1]=cyc[i]*(1-d);
  }
  return cyc;
}
function pricePath(o){
  const y0=o.startYear,y1=o.endYear,h=B24.horizon,price=[],E=o.ease||null;
  if(o.model==='power'){
    for(let y=y0;y<=y1;y++){
      if(!E||y<=Math.max(y0,E.after))price.push(powerLaw(y)*o.mult);
      else price.push(price[price.length-1]*(1+eased(powerLaw(y)/powerLaw(y-1)-1,y,E)));
    }
  }else{
    let p=o.startPrice;price.push(p);
    for(let y=y0+1;y<=y1;y++){p*=1+eased(y<=h?arrFor(o.c,y):worldOther(y)/worldOther(y-1)-1,y,E);price.push(p);}
  }
  const ph=(h>=y0&&h<=y1)?price[h-y0]:NaN,cap=ph*supply(h),other=worldOther(h);
  const trend=price.slice(),cyc=withCycles(trend,y0,o.cycle,E);
  return {startYear:y0,endYear:y1,price:cyc,trend,price2045:ph,cap2045:cap,world2045:cap+other,share2045:cap/(cap+other)};
}
// The Bitcoin24 price for a year, anchored like the workbook at 2024 and $65K.
function modelPrice(c,year){return pricePath({model:'b24',c,startYear:2024,startPrice:B24.price2024,endYear:year}).price[year-2024];}

function normMix(m){
  const t=m.equity+m.realEstate+m.bonds+m.currency;
  if(!(t>0))return {equity:0,realEstate:0,bonds:0,currency:1};
  return {equity:m.equity/t,realEstate:m.realEstate/t,bonds:m.bonds/t,currency:m.currency/t};
}

// Bitcoin-backed credit gets cheaper as bitcoin matures (the simulator's own rule): a rate r given for year y0 moves in a
// straight line to `end` by `year`, then stays there. With end == null the rate stays r.
function toward(r,end,year,y,y0){return end==null?r:r+(end-r)*Math.min(1,Math.max(0,(y-y0)/Math.max(1,year-y0)));}

// One life, year by year from startYear to endYear. s is the freedom year (Infinity = never).
// p: {startYear,endYear,stack,assets,earnings,save,strategy,mix,returns,tax,earningsGrowth,mortgageShare,mortgageRate,
//     spend,inflation,  basis,cgt,path,borrow:{rate,rateEnd,rateYear,maxLtv,liqLtv},strc:{share,rate,rateEnd,rateYear,roc},ease,workGap,
//     strcSave (share of each year's savings into STRC; default the strategy's strc)}
// With cgt 0 and path 'sell' this is the Bitcoin24-based model of the first version exactly.
// Additions (the simulator's own, not Bitcoin24):
//   basis: average cost per BTC of the starting stack. Bitcoin bought later adds its cost. Sales use average cost.
//   cgt:   tax on gains when bitcoin (or STRC past its cost) is sold.
//   path:  how living costs are paid once free, after shares, bonds and cash run out:
//          'sell'   sell bitcoin, paying tax on the gain;
//          'borrow' borrow against the bitcoin up to maxLtv; interest (rate) is added to the loan each year; past
//                   the cap, bitcoin is sold (with tax) to cover costs and to pay the loan back down to the cap.
//                   If the loan ever reaches liqLtv of the bitcoin's value, the lender liquidates: the run fails;
//          'strc'   in the freedom year, swap a share of the bitcoin (taxed) for STRC at its $100 par. Its dividends
//                   (rate) pay costs first, then shares, bonds and cash, then bitcoin sales, and last STRC itself,
//                   sold at $100. With roc, dividends are a return of capital: tax-free until they have returned
//                   your cost, then taxed as gains.
function simulate(p,price,s){
  const y0=p.startYear,st=p.strategy,m=normMix(p.mix),r=p.returns,p0=price[0],nonRE=1-m.realEstate;
  const cgt=p.cgt||0,path=p.path||'sell',B=p.borrow||{rate:0,maxLtv:0,liqLtv:1},S=p.strc||{share:0,rate:0,roc:true};
  let re=p.assets*m.realEstate;                                          // Individual!D28
  const extra=st.extraMortgage*re;                                       // Individual!T14/Y14
  // STRC as savings (the simulator's own): strcMove of what the strategy moves today, and strcSave of each year's
  // savings, buy STRC at its $100 stated amount instead of bitcoin.
  const strcMove=st.strc||0,strcSave=p.strcSave!=null?p.strcSave:(st.strc||0);
  const moved=st.convert*nonRE*p.assets+extra,strc0=moved*strcMove;
  const bought0=(moved-strc0)/p0;
  let btc=p.stack+bought0;                                               // Individual!D26, D23
  let basis=p.stack*(p.basis!=null?p.basis:p0)+bought0*p0;               // total cost of the bitcoin held
  let eq=p.assets*m.equity*(1-st.convert),                               // Individual!D27
      bd=p.assets*m.bonds*(1-st.convert),                                // Individual!D29
      cu=p.assets*m.currency*(1-st.convert);                             // Individual!D30
  let debt=p.mortgageShare*re+extra;                                     // Individual!D32
  let excess=p.save*p.earnings;                                          // Individual!D20 (year one is not invested)
  let earn=p.earnings;                                                   // this year's pay
  const W=p.workGap===true;  // the simulator's own: while working, costs your pay leaves uncovered come out of savings, then assets
  let loan=0,strc=strc0,strcBasis=strc0,taxPaid=0,taxBtc=0,peakLtv=0; // taxBtc: bitcoin given up to pay tax
  const netStart=btc*p0+eq+re+bd+cu+strc-debt,rows=[];
  let ok=true,failYear=null,failReason=null,forced=0;
  const fail=(why)=>{if(ok)failReason=why;ok=false;};
  const loanRate=(y)=>toward(B.rate,B.rateEnd,B.rateYear??p.endYear,y,y0),divRate=(y)=>toward(S.rate,S.rateEnd,S.rateYear??p.endYear,y,y0);
  // Sell enough bitcoin to raise `cash` after tax. Returns [coins sold, cash still missing].
  // keepLtv: while borrowing at the cap, part of each sale also repays the loan so it stays at the cap.
  const sellFor=(cash,px,keepLtv=0)=>{
    if(cash<=0)return [0,0];
    if(btc<=0)return [0,cash];
    const avg=basis/btc,gain=Math.max(0,px-avg),per=Math.max(1e-9,px-gain*cgt-keepLtv*px);
    let n=cash/per,left=0;
    if(n>btc){left=(n-btc)*per;n=btc;}
    taxPaid+=n*gain*cgt;taxBtc+=n*gain*cgt/px;basis-=n*avg;btc-=n;loan=Math.max(0,loan-keepLtv*n*px);
    return [n,left];
  };
  // STRC's dividend for the year: with roc, a tax-free return of capital until it has returned the cost, then taxed as a
  // gain; without it, taxed as income. Returns the dividend after tax.
  const dividend=(y)=>{
    if(!(strc>0))return 0;
    const div=strc*divRate(y);let tax;
    if(S.roc){const back=Math.min(div,strcBasis);strcBasis-=back;tax=(div-back)*cgt;}
    else tax=div*p.tax;
    taxPaid+=tax;return div-tax;
  };
  // Sell STRC at $100 to raise `cash` after tax; returns the cash still missing.
  const sellStrc=(cash)=>{
    if(!(cash>0)||!(strc>0))return cash;
    const gf=Math.max(0,(strc-strcBasis)/strc),per=Math.max(1e-9,1-gf*cgt);
    const v=Math.min(strc,cash/per),tax=v*gf*cgt;
    taxPaid+=tax;strcBasis-=v*(strcBasis/strc);strc-=v;return cash-(v-tax);
  };
  const E=p.ease||null;
  let spend=0;
  for(let y=y0;y<=p.endYear;y++){
    const i=y-y0,px=price[i];
    spend=!E||y<=E.after?p.spend*Math.pow(1+p.inflation,i):spend*(1+eased(p.inflation,y,E)); // your costs this year
    let bought=0,sold=0,income=0;
    if(i>0){
      eq*=1+r.equity;re*=1+r.realEstate;                                // Individual rows 27-28
      bd*=1+r.bonds*(1-p.tax);cu*=1+r.currency*(1-p.tax);                // rows 29-30, yields taxed
      debt*=1+p.mortgageRate;                                            // row 32, interest capitalised
      excess*=1+p.earningsGrowth;                                        // row 20
      earn*=1+p.earningsGrowth;
      if(loan>0)loan*=1+loanRate(y);                                     // interest added to the bitcoin loan
    }
    const short=W&&y<s?Math.max(0,spend-(1-p.save)*earn):0;              // costs the rest of your pay does not cover
    if(i>0&&y<s&&strc>0){income=dividend(y);strc+=income;strcBasis+=income;} // while working, STRC's dividend is reinvested
                                                                         // (from next year, like every other return)
    if(i>0&&y<s){
      const inv0=Math.max(0,excess-short);                               // savings go to costs first
      const toStrc=inv0*strcSave,inv=inv0-toStrc;
      strc+=toStrc;strcBasis+=toStrc;
      bought=inv*st.excess/px;btc+=bought;basis+=inv*st.excess;          // row 22
      const rest=inv*(1-st.excess);
      if(nonRE>0){eq+=rest*m.equity/nonRE;bd+=rest*m.bonds/nonRE;cu+=rest*m.currency/nonRE;}
      else cu+=rest;
    }
    if(short>excess){                                                    // and what savings cannot cover comes out of
      let gap=short-excess,t;                                            // shares, bonds and cash, then bitcoin
      t=Math.min(eq,gap);eq-=t;gap-=t;
      t=Math.min(bd,gap);bd-=t;gap-=t;
      t=Math.min(cu,gap);cu-=t;gap-=t;
      if(gap>0){const [n,left]=sellFor(gap,px);sold+=n;if(sellStrc(left)>1e-6*spend)fail('ran out');}
    }
    if(y>=s){                                                            // free: no earnings
      if(path==='strc'&&y===s&&S.share>0&&btc>0){                         // the swap, once, in the freedom year
        const coins=btc*S.share,avg=basis/btc,gain=Math.max(0,px-avg),tax=coins*gain*cgt;
        taxPaid+=tax;taxBtc+=tax/px;basis-=coins*avg;btc-=coins;sold+=coins;
        strc+=coins*px-tax;strcBasis+=coins*px-tax;
      }
      let need=spend,t;
      if(strc>0){                                                        // dividends first
        income=dividend(y);
        if(income>=need){cu+=income-need;need=0;}else need-=income;
      }
      t=Math.min(eq,need);eq-=t;need-=t;                                 // then equity, bonds, cash
      t=Math.min(bd,need);bd-=t;need-=t;
      t=Math.min(cu,need);cu-=t;need-=t;
      if(path==='borrow'){
        if(loan>0){                                                      // the loan's riskiest point: after interest
          const pre=btc*px>0?loan/(btc*px):Infinity;                      // and the new price, before any sale
          if(pre>peakLtv)peakLtv=pre;
          if(pre>=B.liqLtv)fail('liquidated');                           // the lender liquidates
        }
        const cap=B.maxLtv*btc*px;
        if(loan>cap){                                                    // interest pushed the loan past the cap:
          const avg=btc>0?basis/btc:0,q=px-Math.max(0,px-avg)*cgt;         // sell to pay it back down to the cap
          const n=Math.min(btc,(loan-cap)/Math.max(1e-9,q-B.maxLtv*px));
          taxPaid+=n*Math.max(0,px-avg)*cgt;taxBtc+=n*Math.max(0,px-avg)*cgt/px;basis-=n*avg;btc-=n;sold+=n;loan-=n*q;forced+=n;
        }
        const room=Math.max(0,B.maxLtv*btc*px-loan),take=Math.min(need,room);
        loan+=take;need-=take;
      }
      if(need>0){const [n,left]=sellFor(need,px,path==='borrow'&&loan>0?B.maxLtv:0);sold+=n;need=left;}
      need=sellStrc(need);                                               // last, sell STRC at $100
      if(need>1e-6*spend)fail('ran out');                                // costs not met this year
    }
    const col=btc*px,ltv=col>0?loan/col:(loan>0?Infinity:0);
    if(ltv>peakLtv)peakLtv=ltv;
    if(path==='borrow'&&loan>0&&ltv>=B.liqLtv)fail('liquidated');
    const assets=col+eq+re+bd+cu+strc,net=assets-debt-loan;
    if(y>=s&&!(net>0))fail('underwater');
    rows.push({y,price:px,btc,eq,re,bd,cu,debt,loan,strc,assets,net,spend,sold,bought,income,taxPaid,taxBtc,ltv});
    if(!ok&&failYear==null)failYear=y;                                   // the first year that fails
  }
  // How far bitcoin could fall at the loan's riskiest point before a lender would liquidate it.
  const crashMargin=peakLtv>0?Math.max(0,1-peakLtv/B.liqLtv):1;
  return {ok,rows,netStart,taxPaid,taxBtc,peakLtv,crashMargin,failYear,failReason,forced};
}
// Freedom year: the earliest year from startYear to sMax that stays solvent through endYear.
function solve(p,price,sMax){
  if(p.workGap&&!(p.earnings>0))sMax=p.startYear;                        // no pay, no working years: now or never
  for(let s=p.startYear;s<=sMax;s++){const r=simulate(p,price,s);if(r.ok)return Object.assign({s},r);}
  return Object.assign({s:null},simulate(p,price,Infinity));
}

export { capGrowth, impliedReturn, defaultAssumptions, eased, withCycles, toward, arrFor, worldOther, supply, powerLaw, pricePath, modelPrice, normMix, simulate, solve };
