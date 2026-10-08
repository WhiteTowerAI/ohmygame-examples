import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, cargoSize, chooseHex, collect, contractReward, deliverContract, dispatch, effects, ensureContracts, freshState, parseState, rerollHexes, setRoute, settleOffline, steadyRates, tide, tripDuration, tripPrice, unitCost, voyage } from '../src/economy.ts';
import { drawHexes, familyCounts, HEXES, modifiers } from '../src/hexes.ts';
import type { State } from '../src/economy.ts';
const readyVoyage=()=>{const s=freshState(0);s.region=2;s.runSales=20000;s.discovered=[0,1,2];return s;};
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<Math.max(.00001,Math.max(Math.abs(a),Math.abs(b))*1e-11),`${a} != ${b}`);
const automatic=(hexes:string[]=[]):State=>{
  const s=freshState(0);s.salvage=7;s.presses=Array(5).fill(null);s.ships=Array.from({length:4},()=>({until:null,departed:0,payout:0}));s.captain=true;s.hexes=hexes;s.voyages=hexes.length;return s;
};
test('28 unique hexes form four complete families with deterministic diverse offers',()=>{
  assert.equal(HEXES.length,28);assert.equal(new Set(HEXES.map((h)=>h.id)).size,28);
  const a=drawHexes([],42,1),b=drawHexes([],42,1);assert.deepEqual(a,b);
  assert.equal(a.offers.length,3);assert.equal(new Set(a.offers).size,3);
  assert.notDeepEqual(a.offers,drawHexes([],97,1).offers);
  for(const family of ['salvage','industry','fleet','active'])assert.equal(HEXES.filter((h)=>h.family===family).length,7);
});
test('voyage offers survive loading; pending choice freezes production and cannot duplicate charts',()=>{
  const next=voyage(readyVoyage())!;
  assert.equal(next.hexOffers.length,3);assert.equal(next.hexRerolls,1);
  const restored=parseState(JSON.stringify(next));assert.deepEqual(restored.hexOffers,next.hexOffers);
  const before=structuredClone(restored);advance(restored,3600);assert.deepEqual(restored,before);
  assert.equal(voyage(restored),null);assert.equal(collect(restored),false);
  assert.equal(chooseHex(restored,'not-a-hex'),false);
  const selected=restored.hexOffers[0];assert.equal(chooseHex(restored,selected),true);
  assert.equal(chooseHex(restored,selected),false);assert.deepEqual(restored.hexes,[selected]);
  assert.equal(restored.hexOffers.length,0);assert.equal(restored.hexRerolls,0);
  advance(restored,2);assert.equal(restored.time,2);
});
test('reroll is single-use, excludes the previous offer, and persists',()=>{
  const next=voyage(readyVoyage())!,old=[...next.hexOffers];
  assert.equal(rerollHexes(next),true);assert.ok(next.hexOffers.every((id)=>!old.includes(id)));
  const restored=parseState(JSON.stringify(next));assert.equal(rerollHexes(restored),false);
  assert.deepEqual(restored.hexOffers,next.hexOffers);
});
test('owned hexes persist over voyages and never reappear in an offer',()=>{
  const s=readyVoyage();s.hexes=['deep-hooks','flywheel','merchant-seal'];s.voyages=3;
  const next=voyage(s)!;assert.deepEqual(next.hexes,s.hexes);
  assert.ok(next.hexOffers.every((id)=>!s.hexes.includes(id)));
});
test('finite pool exhaustion supports final choices and subsequent voyages',()=>{
  const s=readyVoyage();s.hexes=HEXES.slice(0,-1).map((h)=>h.id);s.voyages=s.hexes.length;
  const next=voyage(s)!;assert.equal(next.hexOffers.length,1);chooseHex(next,next.hexOffers[0]);
  next.region=2;next.runSales=20000;
  const exhausted=voyage(next)!;assert.equal(exhausted.hexOffers.length,0);assert.equal(exhausted.hexRerolls,0);
  advance(exhausted,10);assert.equal(exhausted.time,10);
});
test('supply hexes grant once and recurring permanent effects remain',()=>{
  const s=freshState(0);s.hexOffers=['assembly-kit','convoy','seed-fund'];s.voyages=1;
  assert.equal(chooseHex(s,'convoy'),true);assert.equal(s.ships.length,3);assert.equal(s.captain,true);
  assert.equal(chooseHex(s,'convoy'),false);assert.equal(s.ships.length,3);
  const next=voyage({...s,region:2,runSales:20000,discovered:[0,1,2]})!;
  assert.ok(next.hexes.includes('convoy'));assert.equal(next.ships.length,1);assert.equal(next.captain,false);
});
test('two and four hex resonances alter actual recipes, output and cargo',()=>{
  const ids=['deep-hooks','magnet','salvage-kit','ore-vein'];
  assert.equal(familyCounts(ids).salvage,4);assert.equal(modifiers(ids).recycle,2);
  const s=automatic(['lean-recipe','twin-mould','flywheel','precision']);s.scrap=30;
  assert.equal(effects(s).input,3);assert.equal(effects(s).output,3);
  const produced=advance(s,4);assert.ok(produced.parts>=15);assert.ok(s.scrap>=0);
  const bulk=automatic(['cargo-hold']);assert.equal(cargoSize(bulk),4);
});
test('discounts and output bonuses affect prices and real steady-state bottlenecks',()=>{
  const s=freshState(0);s.hexes=['scrap-dealer','seed-fund'];
  assert.equal(unitCost(s,'salvage'),18);
  const baseline=automatic(),strong=automatic(['lean-recipe','twin-mould','merchant-seal']);
  assert.ok(steadyRates(strong).coins>steadyRates(baseline).coins);
});
test('route changes only affect future departures, not reserved cargo and locked payouts',()=>{
  const s=freshState(0);s.runSales=32;s.parts=20;
  assert.equal(setRoute(s,'bulk'),true);assert.equal(cargoSize(s),4);assert.equal(tripDuration(s),10);
  const payout=tripPrice(s);dispatch(s);assert.equal(s.parts,16);
  setRoute(s,'premium');assert.equal(tripDuration(s),12);advance(s,10);assert.equal(s.coins,payout);
  assert.equal(setRoute(freshState(0),'express'),false);
});
test('contracts are deterministic, require all materials and pay exactly once',()=>{
  const s=freshState(0);s.runSales=32;ensureContracts(s);assert.equal(s.contracts.length,3);
  const c=s.contracts[0],before=structuredClone(s);
  assert.equal(deliverContract(s,c.id),0);assert.deepEqual(s,before);
  s.scrap=c.scrap;s.parts=c.parts;const reward=contractReward(s,c);
  assert.equal(deliverContract(s,c.id),reward);assert.equal(s.coins,reward);assert.equal(s.runSales,32+reward);
  assert.equal(s.contractsCompleted,1);assert.equal(deliverContract(s,c.id),0);
  assert.ok(s.contracts.every((offer)=>offer.id!==c.id));
  assert.deepEqual(parseState(JSON.stringify(s)),s);
});
test('contract reward hexes and chart bonus multiply once',()=>{
  const s=freshState(0);s.runSales=32;s.hexes=['bounty'];s.chartsEarnedTotal=2;
  ensureContracts(s);close(contractReward(s,s.contracts[0]),s.contracts[0].coins*1.7*1.3);
});
test('tide boundaries are exact and departure speeds are locked',()=>{
  const s=freshState(0);s.salvage=1;
  assert.equal(tide(s).index,0);advance(s,60);assert.equal(tide(s).index,1);assert.equal(effects(s).raw,1.25);
  advance(s,60);assert.equal(tide(s).index,2);assert.equal(tripDuration(s),6.4);
  s.parts=2;dispatch(s);const until=s.ships[0].until;
  advance(s,60);assert.equal(tide(s).index,0);assert.equal(s.ships[0].until,null);assert.ok(until!<180);
});
test('manual effort triggers a bounded optional surge, which expires offline',()=>{
  const s=freshState(0);
  for(let i=0;i<16;i++){collect(s);advance(s,.25);}
  assert.equal(s.effort,0);assert.ok(s.surgeUntil>s.time);assert.equal(effects(s).pressSpeed,1.5);
  for(let i=0;i<32;i++){collect(s);advance(s,.25);}
  assert.ok(s.surgeUntil-s.time<=40);
  settleOffline(s,100000);assert.ok(s.surgeUntil<=s.time);
});
test('old schema-v1 saves migrate without losing resources or tasks',()=>{
  const s=freshState(0);s.coins=128;s.scrap=40;
  const legacy=JSON.parse(JSON.stringify(s));
  for(const key of ['hexes','hexOffers','hexRerolls','seed','route','contracts','contractsCompleted','effort','surgeUntil'])delete legacy[key];
  const restored=parseState(JSON.stringify(legacy));assert.equal(restored.coins,128);assert.equal(restored.scrap,40);
  assert.deepEqual(restored.hexes,[]);assert.equal(restored.route,'balanced');
});
test('malformed, duplicate and forged pending hex/contract states are rejected',()=>{
  const base=freshState(0);
  for(const mutation of [{hexes:['invented']},{hexOffers:['deep-hooks','deep-hooks']},{hexes:['deep-hooks'],voyages:0},{hexRerolls:2},{route:'constructor'},{route:'bad'},{effort:16},{seed:-1},{contracts:[{id:1,kind:0,scrap:0,parts:0,coins:50}]}])assert.throws(()=>parseState(JSON.stringify({...base,...mutation})));
});
test('long multi-phase batching matches segmented settlement after all permanent hexes',()=>{
  const a=automatic(HEXES.map((h)=>h.id));a.salvage=32;a.presses=Array(24).fill(null);a.ships=Array.from({length:20},()=>({until:null,departed:0,payout:0}));
  const b=structuredClone(a);advance(a,43200);
  for(let i=0;i<432;i++)advance(b,100);
  assert.equal(a.scrap,b.scrap);assert.equal(a.parts,b.parts);close(a.coins,b.coins);close(a.rawCarry,b.rawCarry);close(a.time,b.time);
});
test('all hex families, tide, surge, recycling and all routes settle identically online and offline',()=>{
  for(const route of ['balanced','express','bulk','premium'] as const){
    const a=automatic(['deep-hooks','magnet','salvage-kit','ore-vein','lean-recipe','twin-mould','flywheel','mass-production','cargo-hold','trade-wind','precision','overdrive']);
    a.scrap=240;a.parts=80;a.route=route;a.surgeUntil=37;
    const b=structuredClone(a);advance(a,1800);for(let i=0;i<18000;i++)advance(b,.1);
    assert.equal(a.scrap,b.scrap);assert.equal(a.parts,b.parts);close(a.coins,b.coins);close(a.rawCarry,b.rawCarry);
    assert.ok(a.scrap>=0&&a.parts>=0);
  }
});
