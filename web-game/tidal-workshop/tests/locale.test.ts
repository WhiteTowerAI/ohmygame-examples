import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../src/locale';
import { CONTRACT_NAMES, REGIONS, ROUTES, freshState, tide } from '../src/economy';
import { FAMILY, HEXES, RARITY } from '../src/hexes';
import { FOCUSES, ISLANDS, LEGACIES, MILESTONES, REFIT_NAMES } from '../src/progression';

test('English covers every progression, hex, route and tide description',()=>{
  const text=[...REGIONS,...CONTRACT_NAMES,...Object.values(RARITY),...REFIT_NAMES,
    ...Object.values(FAMILY).map(x=>x.name),
    ...HEXES.flatMap(x=>[x.name,x.description]),
    ...Object.values(FOCUSES).flatMap(x=>[x.name,x.detail]),
    ...Object.values(LEGACIES).flatMap(x=>[x.name,x.detail]),
    ...Object.values(ROUTES).flatMap(x=>[x.name,x.description]),
    ...ISLANDS.flatMap(x=>[x.name,x.story]),...MILESTONES.flatMap(x=>[x.name,x.detail])];
  const state=freshState();
  for(const time of [0,60,120]){state.time=time;text.push(tide(state).name,tide(state).description);}
  for(const value of text){
    assert.ok(en(value).trim(),value);
    assert.doesNotMatch(en(value),/[\u3400-\u9fff]/,value);
  }
});

test('interpolated English keeps amounts and save identifiers intact',()=>{
  assert.equal(en('还缺 12.5K 废料'),'Need 12.5K more scrap');
  assert.equal(en('4 台解锁改造'),'Upgrade at 4 machines');
  assert.equal(en('从 28 种未发现海克斯中抽选'),'Choose from 28 undiscovered hexes');
  assert.equal(en('机巧传承 · 5级'),'Engineering · Lv. 5');
  assert.equal(en('重建港口，获得打捞机与 60 金币；在途探索取消'),'Rebuild with a salvager and 60 coins. Active expeditions are canceled.');
  assert.equal(en('tidal-workshop-save-v1'),'tidal-workshop-save-v1');
  assert.equal(en('1.0B +24.0/s'),'1.0B +24.0/s');
});
