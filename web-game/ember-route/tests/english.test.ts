import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, RELICS, ENEMIES, NODE_INFO, KEYWORDS, KIND_LABEL, RARITY_LABEL, cardName, cardText } from '../src/data.ts';
import { Engine } from '../src/engine.ts';
import { englishLog } from '../src/legacy-log.ts';
const han=/[\u3400-\u9fff]/;
test('all player-facing content and category labels are English',()=>{
 const texts=[KEYWORDS,...Object.values(KIND_LABEL),...Object.values(RARITY_LABEL),...RELICS.flatMap(r=>[r.name,r.text]),...Object.values(ENEMIES).map(e=>e.name),...Object.values(NODE_INFO).flatMap(n=>[n.name,n.hint])];
 for(const c of Object.values(CARDS))for(const upgraded of [false,true]){const card={uid:1,id:c.id,upgraded};texts.push(cardName(card),cardText(card));}
 for(const text of texts){assert.ok(text.trim());assert.equal(han.test(text),false,text);}
});
test('legacy Chinese history translates on resume without changing gameplay state',()=>{
 const e=new Engine(42);e.forge('C01');e.enter('1-1');
 e.b.log=['战斗开始。观察意图，规划你的回合。','第 2 回合。','打出「击打⁺」。','弃牌堆洗入抽牌堆。','手牌已满，抽到的牌进入弃牌堆。','裂纹火种：能量 +1。','主动泄压：炉温 -2，格挡 +6。','过热：损失 4 生命，炉温降至 2。','锈刃巡卫：⚔ 4 · ◇ 6 格挡。','失控提灯：煤渣 1。','铁钟监工进入第二阶段：力量 +2！'];
 const saved=JSON.parse(JSON.stringify(e.run));const before=JSON.parse(JSON.stringify(saved));const resumed=new Engine(42,saved);
 assert.deepEqual(resumed.b.log,['Battle begins. Read the intent and plan your turn.','Turn 2.','Played Strike⁺.','Discard pile shuffled into the draw pile.','Hand full. The drawn card goes to discard.','Cracked Ember: Energy +1.','Vent: Heat -2, Block +6.','Overheat: lose 4 HP, set Heat to 2.','Rustblade Sentinel: ⚔ 4 · ◇ 6 Block.','Rogue Lantern: Cinder 1.','Iron Bell Overseer enters phase II: Strength +2!']);
 const after=JSON.parse(JSON.stringify(resumed.run));before.battle.log=[];after.battle.log=[];assert.deepEqual(after,before);
 assert.equal(englishLog('Played Memory Sigil⁺.'),'Played Memory Sigil⁺.');
 assert.equal(han.test(englishLog('未知旧记录')),false);
});
