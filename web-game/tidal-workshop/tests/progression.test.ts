import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, claimMilestone, collect, dispatch, effects, explore, explorationQuote, freshState, learnLegacy, parseState, pressDuration, refit, refitQuote, setFocus, settleOffline, steadyRates, tripDuration, voyage } from '../src/economy.ts';
import { HEXES } from '../src/hexes.ts';
import type { Focus } from '../src/progression.ts';
import { ISLANDS, MILESTONES, REFIT_REQUIREMENTS } from '../src/progression.ts';
import type { Machine, State } from '../src/economy.ts';
const ready = () => {
  const s = freshState(0); s.scrap = 10000; s.parts = 1000; s.coins = 100000;
  s.salvage = 32; s.presses = Array(32).fill(null); s.ships = Array.from({ length: 32 }, () => ({ until: null, departed: 0, payout: 0 }));
  s.captain = true; s.region = 2; s.discovered = [0, 1, 2]; s.runSales = 20000;
  return s;
};
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);

test('milestones pay exactly once, do not inflate sales, and rewards help opening automation', () => {
  const s = freshState(0);
  assert.equal(claimMilestone(s, 'hands'), false);
  s.scrap = 4; assert.equal(claimMilestone(s, 'hands'), true); assert.equal(s.scrap, 12);
  s.runSales = 16; s.coins = 16;
  assert.equal(claimMilestone(s, 'sale'), true); assert.equal(s.coins, 40); assert.equal(s.runSales, 16);
  assert.equal(claimMilestone(s, 'sale'), false); assert.equal(s.coins, 40);
  const restored = parseState(JSON.stringify(s)); assert.equal(claimMilestone(restored, 'sale'), false);
});
test('all target rewards are deterministic and survive reset as permanent records', () => {
  const s = ready(); s.refits.salvage = 1; s.islands = [0, 1, 2, 3]; s.contractsCompleted = 3; s.voyages = 3;
  for (const m of MILESTONES) assert.equal(claimMilestone(s, m.id), true, m.id);
  assert.equal(s.milestones.length, 15);
  const next = voyage(s)!; assert.deepEqual(next.milestones, s.milestones); assert.equal(next.blueprints, s.blueprints);
  assert.equal(claimMilestone(next, 'sale'), false);
});
test('refits enforce count gates, sequential price, caps and real doubling', () => {
  for (const kind of ['salvage', 'press', 'boat'] as Machine[]) {
    const s = ready();
    for (let level = 0; level < 3; level++) {
      assert.equal(refitQuote(s, kind).requirement, REFIT_REQUIREMENTS[level]);
      const before = effects(s), coins = s.coins, quote = refitQuote(s, kind);
      assert.equal(refit(s, kind), true); assert.equal(s.coins, coins - quote.cost);
      const stat = kind === 'salvage' ? 'raw' : kind === 'press' ? 'pressSpeed' : 'sailSpeed';
      close(effects(s)[stat], before[stat] * 2);
    }
    assert.equal(refit(s, kind), false);
  }
  const s = freshState(); s.coins = 10000; s.salvage = 3;
  assert.equal(refit(s, 'salvage'), false); s.salvage = 4; s.coins = 179;
  assert.equal(refit(s, 'salvage'), false); assert.equal(s.coins, 179);
});
test('specializations have different tradeoffs and preserve locked ship outcomes', () => {
  const s = ready(); s.captain = false;
  assert.equal(setFocus(s, 'fleet'), false); s.captain = true;
  const base = effects(s); assert.equal(setFocus(s, 'salvage'), true);
  close(effects(s).raw, base.raw * 1.6); close(effects(s).pressSpeed, base.pressSpeed * .85);
  setFocus(s, 'industry'); close(effects(s).pressSpeed, base.pressSpeed * 1.6);
  const sailing=ready();sailing.captain=false;assert.equal(dispatch(sailing),true);
  const payout=sailing.ships[0].payout,until=sailing.ships[0].until;
  sailing.captain=true;setFocus(sailing,'fleet');refit(sailing,'boat');
  assert.equal(sailing.ships[0].payout,payout);assert.equal(sailing.ships[0].until,until);
  setFocus(s, 'active'); const scrap = s.scrap; collect(s); assert.ok(s.scrap >= scrap);
  assert.equal(effects(s).tap, 4);
});
test('exploration locks full supply cost, permits one trip, respects unlocks and protects trade ships', () => {
  const s = ready(); const ships = structuredClone(s.ships);
  assert.equal(explore(s, -1), false);
  const scrap = s.scrap, parts = s.parts, q = explorationQuote(s, 0)!;
  assert.equal(explore(s, 0), true); assert.equal(s.scrap, scrap - q.scrap); assert.equal(s.parts, parts - q.parts);
  assert.deepEqual(s.ships, ships); const copy = structuredClone(s);
  assert.equal(explore(s, 1), false); assert.deepEqual(s, copy);
  const locked = freshState(); locked.scrap = 1000; locked.parts = 1000; locked.runSales = 95;
  assert.equal(explore(locked, 0), false); locked.runSales = 96; locked.parts = 1;
  assert.equal(explore(locked, 0), false); assert.equal(locked.scrap, 1000);
});
test('island return pays once, first discovery has a bonus, revisits have normal rewards', () => {
  const s = freshState(0); s.scrap = 1000; s.parts = 100; s.runSales = 96;
  explore(s, 0); const job = structuredClone(s.expedition!);
  advance(s, job.until - .01); assert.equal(s.blueprints, 0);
  const result = advance(s, .01); assert.equal(s.expedition, null); assert.deepEqual(s.islands, [0]);
  assert.equal(s.blueprints, 3); assert.equal(result.blueprints, 3); assert.equal(result.exploration, 0);
  assert.equal(s.runSales, 96); close(s.coins, 72);
  advance(s, 500); assert.equal(s.blueprints, 3);
  explore(s, 0); assert.equal(s.expedition!.blueprints, 1); advance(s, 45);
  assert.equal(s.blueprints, 4); assert.deepEqual(s.islands, [0]);
});
test('exploration speed and payout remain locked after focus, tide and technology changes', () => {
  const s = ready(); explore(s, 3); const job = structuredClone(s.expedition!);
  setFocus(s, 'fleet'); refit(s, 'boat'); s.blueprints = 100; learnLegacy(s, 'commerce');
  assert.deepEqual(s.expedition, job);
  advance(s, job.until - s.time); assert.equal(s.blueprints, 100 - 2 + job.blueprints);
});
test('all four islands offer exact normal and first-visit manuscript rewards', () => {
  for (let index = 0; index < ISLANDS.length; index++) {
    const s = ready(); const q = explorationQuote(s, index)!;
    assert.equal(q.blueprints, ISLANDS[index].prints + ISLANDS[index].first);
    explore(s, index); advance(s, s.expedition!.until - s.time);
    assert.equal(s.blueprints, q.blueprints);
    assert.equal(explorationQuote(s, index)!.blueprints, ISLANDS[index].prints);
  }
});
test('offline expedition completion and repeated reload cannot duplicate rewards', () => {
  const s = freshState(0); s.scrap = 1000; s.parts = 100; s.runSales = 96; explore(s, 0);
  const restored = parseState(JSON.stringify(s)); const result = settleOffline(restored, 60000);
  assert.equal(result.blueprints, 3); assert.equal(restored.blueprints, 3);
  const again = parseState(JSON.stringify(restored)); settleOffline(again, 60000);
  assert.equal(again.blueprints, 3); assert.equal(again.coins, restored.coins);
});
test('event batching with active exploration and permanent boosts matches frame simulation', () => {
  const a = ready(); a.refits = { salvage: 1, press: 1, boat: 1 }; a.legacy = { engineering: 2, commerce: 1, supplies: 1 }; a.focus = 'industry';
  explore(a, 2); const b = structuredClone(a);
  advance(a, 720); for (let i = 0; i < 7200; i++) advance(b, .1);
  for (const key of ['scrap', 'parts', 'coins', 'runSales', 'rawCarry', 'time', 'blueprints'] as const) close(a[key], b[key]);
  assert.deepEqual(a.islands, b.islands); assert.equal(a.expedition, null);
});
test('permanent research has escalating cost and max level, applies to actual production', () => {
  const s = ready(); s.blueprints = 100;
  const duration = pressDuration(s), trip = tripDuration(s), raw = effects(s).raw;
  assert.equal(learnLegacy(s, 'engineering'), true); assert.equal(s.blueprints, 98);
  close(pressDuration(s), duration / 1.12); close(tripDuration(s), trip / 1.12); close(effects(s).raw, raw * 1.12);
  for (let i = 1; i < 5; i++) assert.equal(learnLegacy(s, 'engineering'), true);
  assert.equal(s.blueprints, 38); assert.equal(learnLegacy(s, 'engineering'), false);
  const before = steadyRates(s).coins; learnLegacy(s, 'commerce'); close(steadyRates(s).coins, before * 1.15);
});
test('voyage keeps knowledge, clears run strategy, cancels exploration and grants supply legacy', () => {
  const s = ready(); s.blueprints = 9; s.legacy = { engineering: 2, commerce: 1, supplies: 3 }; s.refits = { salvage: 2, press: 2, boat: 2 };
  s.focus = 'fleet'; s.islands = [0, 1]; s.milestones = ['hands', 'sale']; explore(s, 2);
  const next = voyage(s)!; assert.equal(next.coins, 204); assert.equal(next.scrap, 48);
  assert.deepEqual(next.legacy, s.legacy); assert.deepEqual(next.islands, s.islands); assert.deepEqual(next.milestones, s.milestones);
  assert.equal(next.blueprints, 9); assert.equal(next.expedition, null); assert.equal(next.focus, 'balanced');
  assert.deepEqual(next.refits, { salvage: 0, press: 0, boat: 0 });
});
test('stocked batching matches online events through tide and surge boundaries for every strategy', () => {
  for(const focus of ['balanced','salvage','industry','fleet','active'] as Focus[])for(const route of ['balanced','express','bulk','premium'] as const){
    const a=ready();a.refits={salvage:3,press:3,boat:3};a.legacy={engineering:3,commerce:2,supplies:1};
    a.hexes=HEXES.map(h=>h.id);a.voyages=28;a.focus=focus;a.route=route;a.scrap=100000;a.parts=100000;
    a.time=119;a.surgeUntil=131;
    a.ships[0]={departed:112,until:120,payout:37};
    const b=structuredClone(a);advance(a,181);
    for(let i=0;i<1448;i++)advance(b,.125);
    assert.equal(a.scrap,b.scrap,`${focus}/${route} scrap`);assert.equal(a.parts,b.parts,`${focus}/${route} parts`);
    close(a.coins,b.coins);close(a.rawCarry,b.rawCarry);close(a.time,b.time);
    for(let i=0;i<a.ships.length;i++)close(a.ships[i].until!,b.ships[i].until!);
  }
});

test('old saves get growth defaults while malformed progress and expedition jobs are rejected', () => {
  const old: any = freshState(0);
  for (const key of ['refits', 'focus', 'milestones', 'blueprints', 'legacy', 'islands', 'expedition']) delete old[key];
  const migrated = parseState(JSON.stringify(old)); assert.equal(migrated.focus, 'balanced'); assert.equal(migrated.blueprints, 0);
  const mutations: ((s: State) => void)[] = [
    s => { s.blueprints = -1; }, s => { s.legacy.supplies = 6; }, s => { s.refits.salvage = 4; },
    s => { s.islands = [0, 0]; }, s => { s.islands = [4]; }, s => { s.milestones = ['sale', 'sale']; },
    s => { s.milestones = ['fake']; }, s => { s.expedition!.blueprints += 1; }, s => { s.expedition!.until += 1000; },
    s => { s.expedition!.scrap += 1; },
  ];
  for (const mutate of mutations) { const s = ready(); explore(s, 0); mutate(s); assert.throws(() => parseState(JSON.stringify(s))); }
  const gated = freshState(); gated.refits.salvage = 1; assert.throws(() => parseState(JSON.stringify(gated)));
});
