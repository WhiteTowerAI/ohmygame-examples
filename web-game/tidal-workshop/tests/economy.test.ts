import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, buy, collect, craft, dispatch, expand, freshState, hireCaptain, parseState, quote, research, settleOffline, steadyRates, unitCost, voyage, voyageReward } from '../src/economy.ts';
import type { State } from '../src/economy.ts';

const automatic = (): State => {
  const s = freshState(0);
  s.salvage = 1; s.presses = [null]; s.captain = true;
  return s;
};
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);

test('zero-resource opening can complete the first sale; tap is rate limited', () => {
  const s = freshState();
  assert.equal(craft(s), false);
  assert.equal(dispatch(s), false);
  for (let i = 0; i < 8; i++) { assert.equal(collect(s), true); assert.equal(collect(s), false); advance(s, .25); }
  assert.equal(s.scrap, 8);
  assert.equal(craft(s), true);
  assert.equal(craft(s), false);
  advance(s, 2);
  assert.equal(craft(s), true);
  advance(s, 2);
  assert.equal(s.parts, 2);
  assert.equal(dispatch(s), true);
  assert.equal(dispatch(s), false);
  assert.equal(s.parts, 0);
  advance(s, 7.99);
  assert.equal(s.coins, 0);
  advance(s, .01);
  assert.equal(s.coins, 16);
  assert.equal(s.runSales, 16);
  advance(s, 8);
  assert.equal(s.coins, 16);
});
test('automatic pipeline progresses without clicking and never goes negative', () => {
  const s = automatic();
  advance(s, 60);
  assert.ok(s.coins > 0);
  assert.ok(s.scrap >= 0 && s.parts >= 0);
  assert.deepEqual(steadyRates(s), { scrap: 1.25, parts: .25, coins: 2 });
  s.presses.push(null);
  assert.equal(steadyRates(s).coins, 2);
});
test('production inputs are reserved once and completion persists through save', () => {
  const s = freshState(); s.scrap = 4;
  craft(s); advance(s, 1);
  const restored = parseState(JSON.stringify(s));
  advance(restored, 1);
  assert.equal(restored.parts, 1); assert.equal(restored.scrap, 0);
  advance(restored, 10); assert.equal(restored.parts, 1);
});
test('sailing price is fixed at departure', () => {
  const s = freshState(); s.parts = 2;
  dispatch(s);
  s.region = 2; s.chartsEarnedTotal = 10;
  advance(s, 8);
  assert.equal(s.coins, 16);
});
test('10 purchases equal 10 single purchases; gift ship is excluded', () => {
  for (const kind of ['salvage', 'press', 'boat'] as const) {
    const a = freshState(); a.coins = 100000;
    const b = structuredClone(a);
    buy(a, kind, 10);
    for (let i = 0; i < 10; i++) buy(b, kind, 1);
    assert.equal(a.coins, b.coins);
  }
  assert.equal(unitCost(freshState(), 'boat'), 160);
});
test('max purchasing is affordable and exact; insufficient funds cause no mutation', () => {
  const s = freshState(); s.coins = 100;
  const q = quote(s, 'salvage', 'max');
  assert.equal(q.count, 3); assert.equal(q.cost, 86);
  assert.equal(buy(s, 'salvage', 'max'), 3);
  assert.equal(s.coins, 14);
  assert.equal(buy(s, 'press', 1), 0);
  assert.equal(s.coins, 14);
});
test('reference costs and lighthouse income match design', () => {
  const s = freshState(); s.salvage = 8; s.presses = Array(6).fill(null);
  s.ships = Array.from({ length: 6 }, () => ({ until: null, departed: 0, payout: 0 }));
  s.captain = true; s.region = 2;
  assert.deepEqual([unitCost(s,'salvage'),unitCost(s,'press'),unitCost(s,'boat')],[85,162,399]);
  assert.equal(steadyRates(s).coins, 24);
});
test('captain and region unlocks consume cost once', () => {
  const s = freshState(); s.coins = 10000;
  assert.equal(hireCaptain(s), true); assert.equal(hireCaptain(s), false); assert.equal(s.coins, 9920);
  assert.equal(expand(s), false);
  s.runSales = 1200; assert.equal(expand(s), true); assert.equal(s.coins, 9120);
  assert.equal(expand(s), false);
  s.runSales = 12000; assert.equal(expand(s), true); assert.equal(s.coins, 3120);
  assert.equal(expand(s), false);
});
test('long event batching is identical to online frame stepping', () => {
  for (const raw of [1, 3, 8]) {
    const a = automatic(); a.salvage = raw; a.tech.currents = true;
    a.presses = Array(4).fill(null);
    a.ships = Array.from({length:3}, () => ({until:null,departed:0,payout:0}));
    const b = structuredClone(a);
    advance(a, 1200);
    for (let i=0; i<12000; i++) advance(b, .1);
    assert.equal(a.scrap,b.scrap); assert.equal(a.parts,b.parts); close(a.coins,b.coins);
    close(a.rawCarry,b.rawCarry); close(a.time,b.time);
  }
});
test('cycle batching also preserves a depleting-stock pipeline', () => {
  const a = automatic(); a.scrap = 500; a.parts = 100; a.salvage = 1;
  a.presses = Array(5).fill(null); a.ships = Array.from({length:4},()=>({until:null,departed:0,payout:0}));
  const b = structuredClone(a);
  advance(a,3600);
  for (let i=0; i<3600; i++) advance(b,1);
  assert.equal(a.scrap,b.scrap); assert.equal(a.parts,b.parts); assert.equal(a.coins,b.coins);
});
test('offline cap and repeated load cannot duplicate earnings', () => {
  const s = automatic();
  const result = settleOffline(s, 20 * 3600 * 1000);
  assert.equal(result.seconds, 8 * 3600); assert.equal(result.truncated,true);
  assert.ok(s.coins > 0);
  const coins = s.coins;
  const reload = parseState(JSON.stringify(s));
  assert.equal(settleOffline(reload, s.savedAt).coins, 0);
  assert.equal(reload.coins, coins);
  assert.equal(settleOffline(reload, 0).seconds,0);
});
test('offline finishes existing manual tasks but creates no new manual jobs', () => {
  const s = freshState(0); s.scrap=8; craft(s);
  settleOffline(s,60000);
  assert.equal(s.parts,1); assert.equal(s.scrap,4); assert.equal(s.coins,0);
});
test('manual-only shipping is not counted as automated income', () => {
  const s = automatic(); s.captain=false;
  assert.equal(steadyRates(s).coins,0);
  advance(s,100);
  assert.equal(s.coins,0); assert.ok(s.parts>0);
});
test('voyage gate, square-root rewards, reset and supplies are exact', () => {
  const s = automatic(); s.runSales=80000;
  assert.equal(voyage(s),null);
  s.region=2; s.discovered=[0,1,2]; s.scrap=600; s.parts=50; s.coins=9000;
  s.chartsAvailable=3; s.chartsEarnedTotal=5; s.tech.night=true;
  assert.equal(voyageReward(s),2);
  const next = voyage(s)!;
  assert.equal(next.chartsAvailable,5); assert.equal(next.chartsEarnedTotal,7);
  assert.equal(next.salvage,1); assert.equal(next.coins,24); assert.equal(next.scrap,0);
  assert.equal(next.presses.length,0); assert.equal(next.ships.length,1);
  assert.equal(next.runSales,0); assert.equal(next.region,0); assert.equal(next.captain,false);
  assert.equal(next.tech.night,true); assert.deepEqual(next.discovered,[0,1,2]);
  assert.equal(voyageReward(next),0);
  for (const [sales,reward] of [[20000,1],[80000,2],[180000,3]]) { s.runSales=sales; assert.equal(voyageReward(s),reward); }
});
test('research spends available charts without reducing permanent income multiplier', () => {
  const s = freshState(); s.chartsAvailable=3; s.chartsEarnedTotal=3;
  assert.equal(research(s,'currents'),true); assert.equal(research(s,'currents'),false);
  assert.equal(s.chartsAvailable,2); assert.equal(s.chartsEarnedTotal,3);
  assert.equal(research(s,'captain'),true);
  assert.equal(research(s,'night'),false);
});
test('import rejects invalid version, infinite numbers, negative inventories and unsafe job states', () => {
  const base = freshState();
  for (const mutation of [ {schemaVersion:2}, {coins:-1}, {scrap:1.5}, {rawCarry:1}, {captain:'yes'}, {presses:[10000]}, {ships:[]}, {region:9}, {chartsAvailable:1}, {tech:null} ]) {
    assert.throws(() => parseState(JSON.stringify({...base,...mutation})));
  }
  assert.throws(()=>parseState('{invalid json'));
  assert.deepEqual(parseState(JSON.stringify(base)),base);
});
