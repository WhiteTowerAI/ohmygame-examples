import { CARDS, ENEMIES, RELICS, cost, cardName, type Card, type Action, type NodeKind } from './data';
import { englishLog } from './legacy-log';
export interface Status { block:number; burn:number; weak:number; vulnerable:number; strength:number }
export interface Enemy extends Status { id:string; uid:number; hp:number; maxHp:number; index:number; phase:number }
export interface MapNode { id:string; floor:number; col:number; kind:NodeKind; next:string[] }
export interface Battle {
 turn:number; energy:number; heat:number; player:Status; hand:Card[]; draw:Card[]; discard:Card[]; exhaust:Card[];
 enemies:Enemy[]; vented:boolean; firstVent:boolean; heatRelic:boolean; gear:boolean; glove:boolean; cooled:boolean;
 powers:Card[]; log:string[];
}
export interface Pending { type:'recover'|'retain'|'upgrade'|'remove'; source?:string; remaining?:boolean[] }
export type Screen = 'forge'|'map'|'battle'|'reward'|'rest'|'shop'|'event'|'chest'|'finish';
export interface Run {
 version:1; seed:number; rng:number; uid:number; screen:Screen; hp:number; maxHp:number; gold:number; deck:Card[];
 relics:number[]; map:MapNode[]; current:string; path:string[]; battle?:Battle; pending?:Pending;
 reward:string[]; rewardGold:number; rewardRelic?:number; event:number; shop?:{cards:(string|null)[]; relic:number|null; removed:boolean};
 deleteCost:number; penalty:boolean; won:boolean; stats:{battles:number; turns:number; heat:number; overheat:number; damage:number};
}
export interface Effect { kind:'hit'|'block'|'heat'|'vent'|'card'|'enemy'|'win'|'fail'; target?:number; value?:number }
const blank = ():Status => ({block:0,burn:0,weak:0,vulnerable:0,strength:0});
export class Engine {
 run:Run;
 effects:Effect[]=[];
 constructor(seed=Date.now()>>>0, saved?:Run) {
  this.run = saved ?? {version:1,seed:seed>>>0,rng:seed>>>0,uid:0,screen:'forge',hp:68,maxHp:68,gold:80,deck:[],relics:[0],map:[],current:'0-1',path:['0-1'],reward:[],rewardGold:0,event:0,deleteCost:60,penalty:false,won:false,stats:{battles:0,turns:0,heat:0,overheat:0,damage:0}};
  if(saved?.battle)saved.battle.log=saved.battle.log.map(englishLog);
  if(!saved){for(const id of ['C01','C01','C01','C01','C02','C02','C02','C02','C03','C04'])this.run.deck.push(this.makeCard(id));this.run.map=this.makeMap();}
 }
 random(){let t=this.run.rng+=0x6D2B79F5;this.run.rng>>>=0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
 pick<T>(a:T[]):T {return a[Math.floor(this.random()*a.length)];}
 shuffle<T>(a:T[]):T[]{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
 makeCard(id:string):Card{return {uid:++this.run.uid,id,upgraded:false};}
 has(i:number){return this.run.relics.includes(i);}
 get b(){if(!this.run.battle)throw Error('No battle');return this.run.battle;}
 log(s:string){if(this.run.battle){this.b.log.push(s);this.b.log=this.b.log.slice(-40);}}
 makeMap():MapNode[]{
  const map:MapNode[]=[{id:'0-1',floor:0,col:1,kind:'start',next:[]}];
  for(let floor=1;floor<=12;floor++){
   const fixed:Record<number,NodeKind>={1:'battle',3:'shop',6:'chest',11:'rest',12:'boss'};
   const cols=fixed[floor]?[1]:[0,1,2];
   const types:NodeKind[] = floor===4||floor===9 ? ['battle','elite','event'] : floor===5||floor===10 ? ['battle','rest','event'] : ['battle','event','battle'];
   const mixed=this.shuffle(types);
   for(const col of cols)map.push({id:`${floor}-${col}`,floor,col,kind:fixed[floor]??mixed[col],next:[]});
  }
  for(const n of map){const next=map.filter(v=>v.floor===n.floor+1);n.next=next.filter(v=>next.length===1||map.filter(x=>x.floor===n.floor).length===1||v.col===n.col).map(v=>v.id);}
  return map;
 }
 forge(id:string){if(this.run.screen!=='forge')return;const c=this.run.deck.find(c=>c.id===id);if(c)c.upgraded=true;this.run.screen='map';}
 available(){return this.run.map.find(n=>n.id===this.run.current)?.next??[];}
 enter(id:string):boolean{
  const r=this.run;if(r.screen!=='map'||!this.available().includes(id))return false;
  const n=r.map.find(n=>n.id===id)!;r.current=id;r.path.push(id);r.battle=undefined;r.pending=undefined;r.rewardRelic=undefined;
  if(['battle','elite','boss'].includes(n.kind)){this.startBattle(this.encounter(n));}
  else if(n.kind==='shop'){r.screen='shop';r.shop={cards:this.rewardCards(false),relic:this.nextRelic()??null,removed:false};}
  else if(n.kind==='event'){r.screen='event';r.event=Math.floor(this.random()*4);if(this.has(6))this.heal(3);}
  else if(n.kind==='chest'){r.screen='chest';r.rewardRelic=this.nextRelic();}
  else r.screen='rest';return true;
 }
 encounter(n:MapNode):string[]{
  if(n.kind==='boss')return ['boss'];if(n.kind==='elite')return [this.pick(['heavy','stoker'])];if(n.floor===1)return ['sentinel'];
  if(n.floor<5)return this.pick([['sentinel'],['whelp','lantern'],['crawler']]);
  return this.pick([['sentinel','whelp'],['priest','crawler'],['guard','lantern'],['crawler','whelp'],['guard']]);
 }
 startBattle(ids:string[]){
  this.run.screen='battle';this.run.pending=undefined;this.effects=[];
  this.run.battle={turn:0,energy:3,heat:0,player:blank(),hand:[],draw:this.shuffle(this.run.deck.map(c=>({...c,bonus:0,keep:false}))),discard:[],exhaust:[],enemies:ids.map(id=>({id,uid:++this.run.uid,hp:ENEMIES[id].hp,maxHp:ENEMIES[id].hp,index:0,phase:1,...blank()})),vented:false,firstVent:false,heatRelic:false,gear:false,glove:false,cooled:false,powers:[],log:['Battle begins. Read the intent and plan your turn.']};
  this.beginTurn();
 }
 draw(n:number){const b=this.b;for(let i=0;i<n;i++){
  if(!b.draw.length){if(!b.discard.length)break;b.draw=this.shuffle(b.discard);b.discard=[];this.log('Discard pile shuffled into the draw pile.');}
  const c=b.draw.pop()!;if(b.hand.length>=10){b.discard.push(c);this.log('Hand full. The drawn card goes to discard.');}else b.hand.push(c);
 }}
 beginTurn(){
  const b=this.b;b.turn++;this.run.stats.turns++;b.player.block=0;b.energy=b.turn===1&&this.run.penalty?2:3;
  if(b.turn===1)this.run.penalty=false;b.vented=false;b.cooled=false;
  const valves=b.powers.filter(c=>c.id==='C21');this.cool(valves.length?2:1);
  for(const p of b.powers)if(p.id==='C18'){this.heat(1);if(p.upgraded)b.player.block+=2;}
  if(b.turn===1&&this.has(3))b.player.block+=8;this.draw(5);this.log(`Turn ${b.turn}.`);
 }
 heat(n:number){const b=this.b;b.heat=Math.max(0,Math.min(6,b.heat+n));this.run.stats.heat=Math.max(this.run.stats.heat,b.heat);
  if(b.heat>=4&&this.has(1)&&!b.heatRelic){b.energy++;b.heatRelic=true;this.log('Cracked Ember: Energy +1.');}
 }
 cool(n:number){const before=this.b.heat;this.b.heat=Math.max(0,before-n);const amount=before-this.b.heat;
  if(amount>0&&!this.b.cooled){this.b.cooled=true;const count=this.b.powers.filter(c=>c.id==='C21').length;if(count)this.draw(count);}
  return amount;
 }
 ventValue(){return 4+this.b.powers.filter(c=>c.id==='C16').reduce((sum,c)=>sum+(c.upgraded?5:3),0)+(!this.b.firstVent&&this.has(0)?2:0);}
 vent():boolean{
  if(this.run.screen!=='battle'||this.run.pending||this.b.vented||this.b.heat<2)return false;
  const value=this.ventValue();this.cool(2);this.b.player.block+=value;this.b.vented=true;this.b.firstVent=true;
  this.log(`Vent: Heat -2, Block +${value}.`);this.effects.push({kind:'vent',value});return true;
 }
 attackDamage(base:number,attacker:Status,target:Status){let d=base+attacker.strength;if(attacker.weak)d=Math.floor(d*.75);if(target.vulnerable)d=Math.floor(d*1.5);return Math.max(0,d);}
 damageEnemy(e:Enemy,n:number){const absorbed=Math.min(e.block,n);e.block-=absorbed;e.hp=Math.max(0,e.hp-(n-absorbed));this.effects.push({kind:'hit',target:e.uid,value:n-absorbed});}
 damagePlayer(n:number,direct=false){const absorbed=direct?0:Math.min(this.b.player.block,n);this.b.player.block-=absorbed;const lost=Math.min(this.run.hp,n-absorbed);this.run.hp-=lost;this.run.stats.damage+=lost;this.effects.push({kind:'hit',value:lost});if(this.run.hp<=0)this.fail();}
 fail(){this.run.hp=0;this.run.screen='finish';this.run.won=false;this.run.pending=undefined;this.effects.push({kind:'fail'});}
 living(){return this.b.enemies.filter(e=>e.hp>0);}
 checkWin(){if(this.run.screen!=='battle')return true;if(this.living().length)return false;this.win();return true;}
 nextRelic():number|undefined {const pool=RELICS.map((_,i)=>i).filter(i=>!this.has(i));return pool.length?this.pick(pool):undefined;}
 rewardCards(elite:boolean,rarity?:string){const ids:string[]=[];for(let i=0;i<3;i++){
  const p=this.random();const quality=rarity??(p<(elite?.45:.70)?'普通':p<(elite?.85:.95)?'精良':'稀有');
  const pool=Object.values(CARDS).filter(c=>c.kind!=='状态'&&c.rarity===quality&&!ids.includes(c.id));
  ids.push(this.pick(pool).id);
 }return ids;}
 win(){
  const r=this.run;r.pending=undefined;r.stats.battles++;const kind=r.map.find(n=>n.id===r.current)?.kind;
  this.effects.push({kind:'win'});if(kind==='boss'){r.won=true;r.screen='finish';return;}
  r.rewardGold=(kind==='elite'?35:15)+Math.floor(this.random()*11)+(this.has(5)?10:0);r.gold+=r.rewardGold;
  if(kind==='elite'){const relic=this.nextRelic();r.rewardRelic=relic;if(relic!==undefined)r.relics.push(relic);}
  r.reward=this.rewardCards(kind==='elite');r.screen='reward';
 }
 baseDamage(c:Card){const u=Number(c.upgraded),high=this.b.heat>=4;const damage:Record<string,number>={C01:6+u*3,C04:8+u*3+(high?5:0),C05:5+u*2,C09:7+u*3,C12:18+u*5+(high?10:0),C13:3+u,C19:14+u*5,C23:Math.min(this.b.player.block,u?40:30),C24:36+u*9};return damage[c.id]??0;}
 preview(c:Card,e?:Enemy){
  if(CARDS[c.id].kind!=='攻击')return '';
  const base=this.baseDamage(c)+(c.bonus??0),gear=!this.b.gear&&this.has(4)&&(c.id!=='C19'||!e||e.uid===this.living()[0]?.uid)?3:0;
  const first=e?this.attackDamage(base+gear,this.b.player,e):base+gear,other=e?this.attackDamage(base,this.b.player,e):base;
  const total=first+(c.id==='C13'?other*2:0),label=c.id==='C13'?(first===other?`${first} ×3`:`${first} + ${other}×2`):String(first);
  return `${label} damage${e?` · ${Math.min(e.hp,Math.max(0,total-e.block))} HP lost`:''}`;
 }
 canPlay(c:Card):string|undefined{
  if(this.run.screen!=='battle'||this.run.pending)return 'Complete the current choice first.';if(CARDS[c.id].kind==='状态')return 'Status cards cannot be played.';if(cost(c)>this.b.energy)return 'Not enough Energy.';
  if(c.id==='C15'&&!this.b.discard.some(d=>d.id!=='C15'))return 'No eligible cards in the discard pile.';return undefined;
 }
 play(uid:number,targetUid?:number):boolean{
  const b=this.b,c=b.hand.find(c=>c.uid===uid);if(!c||this.canPlay(c))return false;
  const def=CARDS[c.id],target=b.enemies.find(e=>e.uid===targetUid&&e.hp>0);if(def.target&&!target)return false;
  b.energy-=cost(c);b.hand=b.hand.filter(v=>v.uid!==uid);const u=Number(c.upgraded),bonus=c.bonus??0;
  this.log(`Played ${cardName(c)}.`);this.effects.push({kind:'card'});
  if(def.kind==='攻击'){
   let gear=!b.gear&&this.has(4)?3:0;b.gear=true;
   const targets=c.id==='C19'?this.living():[target!];
   for(const e of targets)for(let i=0;i<(c.id==='C13'?3:1);i++){
    if(e.hp<=0)break;this.damageEnemy(e,this.attackDamage(this.baseDamage(c)+bonus+gear,b.player,e));gear=0;
    if(this.checkWin())return true;
   }
  }
  switch(c.id){
   case 'C02':b.player.block+=6+3*u+bonus;break;
   case 'C03':this.heat(2);this.draw(1+u);break;
   case 'C05':if(target!.hp>0)target!.burn+=3+u;this.heat(1);break;
   case 'C06':b.player.block+=8+3*u+bonus;this.heat(1);break;
   case 'C07':this.cool(2);b.player.block+=3+2*u+bonus;break;
   case 'C08':this.draw(3+u);this.heat(1);break;
   case 'C09':if(target!.hp>0)target!.vulnerable+=1+u;break;
   case 'C10':for(const e of this.living())e.weak+=1+u;this.cool(1);break;
   case 'C11':b.player.block+=10+3*u+bonus;this.heat(2);break;
   case 'C12':case 'C19':this.heat(2);break;
   case 'C13':this.heat(1);break;
   case 'C14':for(const e of this.living())e.burn+=4+2*u;break;
   case 'C15':this.run.pending={type:'recover'};break;
   case 'C17':if(this.cool(3)>=2)this.draw(2);break;
   case 'C20':this.heat(3);b.energy+=2+u;break;
   case 'C24':this.heat(6-b.heat);break;
  }
  c.bonus=0;c.keep=false;
  if(def.kind==='能力')b.powers.push(c);else if(def.exhaust)b.exhaust.push(c);else b.discard.push(c);
  return true;
 }
 action(e:Enemy):Action{
  if(e.id==='boss'&&e.phase===2)return [{damage:10,hits:2},{damage:18,weak:1},{block:12,junk:1}][e.index%3];
  return ENEMIES[e.id].cycle[e.index%ENEMIES[e.id].cycle.length];
 }
 intention(e:Enemy):string{
  const a=this.action(e),parts:string[]=[];
  if(a.damage){const d=this.attackDamage(a.damage,e,this.b.player);parts.push(`⚔ ${d}${(a.hits??1)>1?`×${a.hits}`:''}`);}
  if(a.block||a.allBlock)parts.push(`◇ ${a.block??a.allBlock} Block`);
  if(a.weak)parts.push(`Weak ${a.weak}`);if(a.burn)parts.push(`Burn ${a.burn}`);if(a.junk)parts.push(`Cinder ${a.junk}`);if(a.heat)parts.push(`Heat +${a.heat}`);if(a.strength)parts.push(`Strength +${a.strength}`);return parts.join(' · ');
 }
 endTurn(skipMemory=false):boolean{
  if(this.run.screen!=='battle'||this.run.pending)return false;
  if(!skipMemory){const memory=this.b.powers.filter(c=>c.id==='C22').map(c=>c.upgraded);if(memory.length&&this.b.hand.some(c=>!CARDS[c.id].retain)){
   this.run.pending={type:'retain',remaining:memory};return true;
  }}
  const b=this.b;for(const c of b.hand)if(c.id==='S02'){this.damagePlayer(1,true);if(this.run.screen!=='battle')return true;}
  if(this.has(2)&&b.heat===0)b.player.block+=4;
  b.discard.push(...b.hand.filter(c=>!CARDS[c.id].retain&&!c.keep));b.hand=b.hand.filter(c=>CARDS[c.id].retain||c.keep);for(const c of b.hand)c.keep=false;
  if(b.player.burn){this.damagePlayer(b.player.burn);b.player.burn--;if(this.run.screen!=='battle')return true;}
  if(b.player.weak)b.player.weak--;if(b.player.vulnerable)b.player.vulnerable--;
  if(b.heat===6){const n=this.has(7)&&!b.glove?1:4;b.glove=true;this.run.stats.overheat++;this.log(`Overheat: lose ${n} HP, set Heat to 2.`);this.damagePlayer(n,true);b.heat=2;if(this.run.screen!=='battle')return true;}
  for(const e of b.enemies){
   if(e.hp<=0)continue;e.block=0;const a=this.action(e);this.log(`${ENEMIES[e.id].name}: ${this.intention(e)}.`);
   if(a.block)e.block+=a.block;if(a.allBlock)for(const enemy of this.living())enemy.block+=a.allBlock;
   if(a.heat)this.heat(a.heat);
   if(a.damage)for(let i=0;i<(a.hits??1);i++){this.damagePlayer(this.attackDamage(a.damage,e,b.player));if(this.run.screen!=='battle')return true;}
   if(a.weak)b.player.weak+=a.weak;if(a.burn)b.player.burn+=a.burn;
   if(a.junk)for(let i=0;i<a.junk;i++)b.discard.push(this.makeCard('S01'));
   if(a.strength)e.strength+=a.strength;
   if(e.burn){this.damageEnemy(e,e.burn);e.burn--;if(this.checkWin())return true;}
   if(e.weak)e.weak--;if(e.vulnerable)e.vulnerable--;e.index++;
   if(e.id==='boss'&&e.hp>0&&e.hp<=75&&e.phase===1){e.phase=2;e.index=0;e.strength+=2;this.log('Iron Bell Overseer enters phase II: Strength +2!');}
  }
  if(!this.checkWin())this.beginTurn();return true;
 }
 choosePending(uid?:number):boolean{
  const p=this.run.pending;if(!p)return false;
  if(p.type==='recover'){
   const c=this.b.discard.find(c=>c.uid===uid&&c.id!=='C15');if(!c)return false;
   this.b.discard=this.b.discard.filter(v=>v.uid!==uid);if(this.b.hand.length<10)this.b.hand.push(c);else this.b.discard.push(c);this.run.pending=undefined;return true;
  }
  if(p.type==='retain'){
   const c=this.b.hand.find(c=>c.uid===uid&&!CARDS[c.id].retain&&!c.keep);if(uid!==undefined&&!c)return false;
   const upgraded=p.remaining!.shift();if(c){c.keep=true;if(upgraded)c.bonus=(c.bonus??0)+3;}
   if(!p.remaining!.length||!this.b.hand.some(c=>!CARDS[c.id].retain&&!c.keep)){this.run.pending=undefined;this.endTurn(true);}return true;
  }
  const c=this.run.deck.find(c=>c.uid===uid);if(!c)return false;
  if(p.type==='upgrade'){if(c.upgraded||CARDS[c.id].kind==='状态')return false;c.upgraded=true;}
  else this.run.deck=this.run.deck.filter(c=>c.uid!==uid);
  this.run.pending=undefined;this.run.screen=p.source==='shop'?'shop':'map';return true;
 }
 chooseReward(id?:string){if(this.run.screen!=='reward')return false;if(id!==undefined){if(!this.run.reward.includes(id))return false;this.run.deck.push(this.makeCard(id));}this.run.reward=[];this.run.screen='map';return true;}
 leave(){if(['shop','event'].includes(this.run.screen)&&!this.run.pending)this.run.screen='map';}
 heal(n:number){this.run.hp=Math.min(this.run.maxHp,this.run.hp+n);}
 rest(choice:'heal'|'upgrade'){
  if(this.run.screen!=='rest')return false;if(choice==='heal'){this.heal(Math.ceil(this.run.maxHp*.3));this.run.screen='map';}
  else {if(!this.run.deck.some(c=>!c.upgraded&&CARDS[c.id].kind!=='状态'))return false;this.run.pending={type:'upgrade',source:'rest'};}return true;
 }
 price(id:string){return {'普通':45,'精良':75,'稀有':120}[CARDS[id].rarity];}
 buy(index:number){const r=this.run;if(r.screen!=='shop'||r.pending)return false;const id=r.shop?.cards[index];if(!id||r.gold<this.price(id))return false;r.gold-=this.price(id);r.deck.push(this.makeCard(id));r.shop!.cards[index]=null;return true;}
 buyRelic(){const r=this.run;if(r.screen!=='shop'||r.pending||r.shop?.relic==null||r.gold<150)return false;r.gold-=150;r.relics.push(r.shop.relic);r.shop.relic=null;return true;}
 removeCard(){const r=this.run;if(r.screen!=='shop'||r.pending||r.shop?.removed||r.gold<r.deleteCost||r.deck.length<=1)return false;r.gold-=r.deleteCost;r.deleteCost+=20;r.shop!.removed=true;r.pending={type:'remove',source:'shop'};return true;}
 chest(){const r=this.run;if(r.screen!=='chest')return;if(r.rewardRelic!==undefined&&!this.has(r.rewardRelic))r.relics.push(r.rewardRelic);r.screen='map';}
 eventChoice(index:number):boolean{
  const r=this.run;if(r.screen!=='event'||r.pending)return false;
  if(index===2){r.screen='map';return true;}
  switch(r.event){
   case 0:if(r.hp<=8)return false;this.damageEvent(8);r.reward=this.rewardCards(false,'精良');r.rewardGold=0;r.screen='reward';break;
   case 1:if(index===0){if(r.gold<45||r.deck.length<=1)return false;r.gold-=45;r.pending={type:'remove',source:'event'};}else{r.gold+=35;r.deck.push(this.makeCard('S02'));r.screen='map';}break;
   case 2:if(index===0){this.heal(10);r.screen='map';}else{if(r.gold<30)return false;r.gold-=30;r.reward=this.rewardCards(false,'普通');r.rewardGold=0;r.screen='reward';}break;
   case 3:if(!r.deck.some(c=>!c.upgraded&&CARDS[c.id].kind!=='状态'))return false;r.penalty=true;r.pending={type:'upgrade',source:'event'};break;
  }return true;
 }
 damageEvent(n:number){this.run.hp-=n;this.run.stats.damage+=n;}
}
