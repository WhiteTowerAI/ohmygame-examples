import { CARDS, ENEMIES } from './data';
// Translate v1 battle history without changing saved cards, RNG or combat state.
const oldCards=['击打','防护','添薪','炉锤','火星','铜壁','冷凝','寻火','破甲钉','蒸汽雾','蓄压','爆炉斩','连锻','焦油瓶','回火','余烬护体','冷却循环','预热','炉心脉冲','熔金','恒温阀','记忆锻印','冷钢反击','最后一火','煤渣','锈蚀'];
const names:Record<string,string>=Object.fromEntries(oldCards.map((name,i)=>[name,CARDS[i<24?`C${String(i+1).padStart(2,'0')}`:`S0${i-23}`].name]));
Object.assign(names,Object.fromEntries(['锈刃巡卫','煤烟幼兽','失控提灯','阀门祭司','炉渣爬虫','铜壳守卫','双锤重卫','无头司炉','铁钟监工'].map((name,i)=>[name,ENEMIES[['sentinel','whelp','lantern','priest','crawler','guard','heavy','stoker','boss'][i]].name])));
const fixed:Record<string,string>={
 '战斗开始。观察意图，规划你的回合。':'Battle begins. Read the intent and plan your turn.',
 '弃牌堆洗入抽牌堆。':'Discard pile shuffled into the draw pile.',
 '手牌已满，抽到的牌进入弃牌堆。':'Hand full. The drawn card goes to discard.',
 '裂纹火种：能量 +1。':'Cracked Ember: Energy +1.',
 '铁钟监工进入第二阶段：力量 +2！':'Iron Bell Overseer enters phase II: Strength +2!'
};
export function englishLog(value:string):string{
 if(!/[\u3400-\u9fff]/.test(value))return value;
 if(fixed[value])return fixed[value];
 let match=value.match(/^第 (\d+) 回合。$/);if(match)return `Turn ${match[1]}.`;
 match=value.match(/^打出「(.+?)」。$/);if(match){const base=match[1].replace('⁺','');return `Played ${names[base]??'a card'}${match[1].endsWith('⁺')?'⁺':''}.`;}
 match=value.match(/^主动泄压：炉温 -2，格挡 \+(\d+)。$/);if(match)return `Vent: Heat -2, Block +${match[1]}.`;
 match=value.match(/^过热：损失 (\d+) 生命，炉温降至 2。$/);if(match)return `Overheat: lose ${match[1]} HP, set Heat to 2.`;
 let result=value;for(const [old,name]of Object.entries(names))result=result.replaceAll(old,name);
 result=result.replaceAll('格挡','Block').replaceAll('虚弱','Weak').replaceAll('燃烧','Burn').replaceAll('升温','Heat +').replaceAll('力量','Strength').replaceAll('：',': ').replaceAll('。','.').replaceAll('！','!');
 return /[\u3400-\u9fff]/.test(result)?'Earlier action recorded.':result;
}
