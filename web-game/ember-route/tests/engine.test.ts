import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.ts';
import { CARDS, ENEMIES, cost } from '../src/data.ts';
function battle(ids=['sentinel']){const e=new Engine(42);e.forge('C01');e.enter('1-1');if(ids[0]!=='sentinel'||ids.length!==1)e.startBattle(ids);return e;}
function hand(e:Engine,...ids:string[]){e.b.hand=ids.map(id=>e.makeCard(id));return e.b.hand;}
test('design example: high heat uses pre-card temperature and first vent grants 6 block',()=>{
 const e=battle(),[fuel,hammer,guard]=hand(e,'C03','C04','C02');e.b.heat=3;
 assert.equal(e.play(fuel.uid),true);assert.equal(e.b.heat,5);
 assert.equal(e.play(hammer.uid,e.b.enemies[0].uid),true);assert.equal(e.b.enemies[0].hp,19);assert.equal(e.b.heat,5);
 e.play(guard.uid);e.vent();assert.equal(e.b.player.block,12);assert.equal(e.b.heat,3);assert.equal(e.vent(),false);
 e.endTurn();assert.equal(e.run.hp,68);assert.equal(e.b.heat,2);assert.equal(e.b.vented,false);
});
test('overheat bypasses block, cools before enemy actions, fatal overheat cancels enemy turn',()=>{
 const e=battle();e.b.heat=6;e.b.player.block=100;e.endTurn();assert.equal(e.run.hp,64);assert.equal(e.b.heat,1);assert.equal(e.run.stats.overheat,1);
 const fatal=battle();fatal.run.hp=4;fatal.b.heat=6;fatal.endTurn();assert.equal(fatal.run.screen,'finish');assert.equal(fatal.b.enemies[0].index,0);assert.equal(fatal.run.won,false);
});
test('killing last enemy immediately wins and cancels heat generation/overheat',()=>{
 const e=battle(),[fire]=hand(e,'C24');e.run.hp=3;e.b.heat=5;e.play(fire.uid,e.b.enemies[0].uid);
 assert.equal(e.run.screen,'reward');assert.equal(e.run.hp,3);assert.equal(e.b.heat,5);assert.equal(e.run.stats.overheat,0);assert.equal(e.endTurn(),false);
});
test('draw reshuffles only discard; ten-card limit does not lose cards or recycle exhaust',()=>{
 const e=battle();e.b.draw=[];e.b.discard=hand(e,'C01','C02');e.b.hand=[];e.b.exhaust=[e.makeCard('C20')];e.draw(2);
 assert.equal(e.b.hand.length,2);assert.equal(e.b.exhaust.length,1);assert.equal(e.b.draw.length,0);
 e.b.hand=Array.from({length:10},()=>e.makeCard('C01'));e.b.draw=[e.makeCard('C02')];e.draw(1);assert.equal(e.b.hand.length,10);assert.equal(e.b.discard.length,1);
});
test('multi-hit attack spends block per hit; weakness and vulnerability round down in order',()=>{
 const e=battle(['whelp']);e.b.enemies[0].index=1;e.b.player.block=7;e.endTurn();assert.equal(e.run.hp,63);
 assert.equal(e.attackDamage(7,{...e.b.player,strength:1,weak:1},{...e.b.player,vulnerable:1}),9);
});
test('damage previews match multi-hit block and the relic bonus applies only to the first hit/target',()=>{
 const e=battle(['boss']);e.run.relics=[4];const [c]=hand(e,'C13'),target=e.b.enemies[0];target.block=5;
 assert.equal(e.preview(c,target),'6 + 3×2 damage · 7 HP lost');const hp=target.hp;e.play(c.uid,target.uid);assert.equal(hp-target.hp,7);
 const area=battle(['sentinel','whelp']);area.run.relics=[4];const [pulse]=hand(area,'C19'),[first,second]=area.b.enemies;
 assert.equal(area.preview(pulse,first),'17 damage · 17 HP lost');assert.equal(area.preview(pulse,second),'14 damage · 14 HP lost');
 const before=area.b.enemies.map(x=>x.hp);area.play(pulse.uid);assert.equal(before[0]-first.hp,17);assert.equal(before[1]-second.hp,14);
});
test('boss keeps already revealed phase-one intent then switches to phase two',()=>{
 const e=battle(['boss']);e.b.enemies[0].hp=78;const [strike]=hand(e,'C01');e.play(strike.uid,e.b.enemies[0].uid);
 assert.equal(e.b.enemies[0].hp,72);assert.equal(e.b.enemies[0].phase,1);assert.equal(e.intention(e.b.enemies[0]),'⚔ 12');
 e.endTurn();assert.equal(e.run.hp,56);assert.equal(e.b.enemies[0].phase,2);assert.equal(e.intention(e.b.enemies[0]),'⚔ 12×2');
});
test('retention prompts complete end turn; recovery cannot target itself',()=>{
 const e=battle();const [memory,guard]=hand(e,'C22','C02');memory.upgraded=true;e.play(memory.uid);assert.equal(e.endTurn(),true);assert.equal(e.run.pending?.type,'retain');
 e.choosePending(guard.uid);assert.ok(e.b.hand.find(c=>c.uid===guard.uid));assert.equal(guard.bonus,3);assert.equal(e.run.pending,undefined);assert.equal(e.b.turn,2);
 const h=battle(),[recovery]=hand(h,'C15');assert.equal(h.canPlay(recovery),'No eligible cards in the discard pile.');h.b.discard=[h.makeCard('C02')];assert.equal(h.play(recovery.uid),true);assert.equal(h.b.exhaust[0].id,'C15');h.choosePending(h.b.discard[0].uid);assert.equal(h.b.hand[0].id,'C02');
});
test('all 24 cards resolve without invalid values, status cards cannot be played',()=>{
 const ids=Object.keys(CARDS).filter(id=>id.startsWith('C'));assert.equal(ids.length,24);
 for(const id of ids)for(const upgraded of [false,true]){
  const e=battle(['boss']),[c]=hand(e,id);c.upgraded=upgraded;e.b.energy=10;e.b.heat=4;e.b.player.block=14;e.b.discard=[e.makeCard('C02')];
  assert.equal(e.play(c.uid,e.b.enemies[0].uid),true,`${id} upgraded=${upgraded}`);assert.ok(Number.isFinite(e.b.energy)&&e.b.energy>=0);assert.ok(e.b.heat>=0&&e.b.heat<=6);
  if(e.run.pending?.type==='recover')e.choosePending(e.b.discard.find(c=>c.id!=='C15')!.uid);
 }
 for(const id of ['S01','S02']){const e=battle(),[c]=hand(e,id);assert.equal(e.play(c.uid),false);}
});
test('seeded maps are reachable; every path reaches boss through shop/rest, no >2 elites',()=>{
 for(let seed=0;seed<100;seed++){
  const e=new Engine(seed),map=e.run.map,visited=new Set<string>();
  function walk(id:string,shop=false,rest=false,elites=0,prevElite=false){const n=map.find(n=>n.id===id)!;visited.add(id);assert.ok(n.kind!=='elite'||n.floor>=4);assert.ok(!(prevElite&&n.kind==='elite'));elites+=Number(n.kind==='elite');assert.ok(elites<=2);shop||=n.kind==='shop';rest||=n.kind==='rest';
   if(n.floor===12){assert.equal(n.kind,'boss');assert.ok(shop&&rest);return;}
   assert.ok(n.next.length);for(const next of n.next){assert.equal(map.find(v=>v.id===next)!.floor,n.floor+1);walk(next,shop,rest,elites,n.kind==='elite');}
  }
  walk('0-1');assert.equal(visited.size,map.length);assert.ok(map.filter(n=>n.floor===6).every(n=>n.kind==='chest'));
 }
});
test('rewards, store purchases and chest claims cannot be repeated; save resumes RNG and battle',()=>{
 const e=battle();e.b.enemies[0].hp=1;const [strike]=hand(e,'C01');e.play(strike.uid,e.b.enemies[0].uid);const id=e.run.reward[0];e.chooseReward(id);const deck=e.run.deck.length;assert.equal(e.chooseReward(id),false);assert.equal(e.run.deck.length,deck);
 e.enter(e.available()[0]);if(e.run.screen==='battle'){e.b.enemies.forEach(x=>x.hp=0);e.checkWin();e.chooseReward();}else e.leave();e.enter('3-1');e.run.gold=500;assert.equal(e.buy(0),true);const gold=e.run.gold;assert.equal(e.buy(0),false);assert.equal(e.run.gold,gold);
 const copy=new Engine(e.run.seed,JSON.parse(JSON.stringify(e.run)));assert.equal(JSON.stringify(copy.run),JSON.stringify(e.run));assert.equal(copy.random(),e.random());
 const chest=battle();chest.run.screen='chest';chest.run.rewardRelic=1;chest.chest();chest.chest();assert.equal(chest.run.relics.filter(i=>i===1).length,1);
});
test('all relics trigger at their defined boundary and consumed effects do not repeat',()=>{
 const e=battle();e.run.relics=[0,1,2,3,4,5,6,7];e.startBattle(['boss']);assert.equal(e.b.player.block,8);
 const [fuel,strike]=hand(e,'C03','C01');e.b.heat=2;e.play(fuel.uid);assert.equal(e.b.energy,4);e.play(strike.uid,e.b.enemies[0].uid);assert.equal(e.b.enemies[0].hp,141);assert.equal(e.b.gear,true);
 e.b.heat=6;e.b.player.block=99;e.endTurn();assert.equal(e.run.hp,67);e.b.heat=6;e.b.player.block=99;e.endTurn();assert.equal(e.run.hp,63);
 e.b.heat=0;e.b.player.block=0;e.b.enemies[0].index=0;e.endTurn();assert.equal(e.run.hp,55); // 12 attack, ring absorbs 4
});
