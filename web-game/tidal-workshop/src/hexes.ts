export type Family = 'salvage' | 'industry' | 'fleet' | 'active';
export type Rarity = 'silver' | 'gold' | 'prismatic';
export interface Hex {
  id: string; name: string; family: Family; rarity: Rarity; icon: string; description: string;
  effects: Partial<Modifiers>;
  supply?: { coins?: number; salvage?: number; presses?: number; boats?: number; captain?: boolean };
}
export interface Modifiers {
  raw: number; pressSpeed: number; sailSpeed: number; price: number; discount: number;
  input: number; output: number; recycle: number; cargo: number; tap: number;
  manualSpeed: number; contract: number; surge: number;
}
export const FAMILY = {
  salvage: { name: '深海打捞', icon: 'icon-salvage', color: '#4c9985' },
  industry: { name: '精密工坊', icon: 'icon-press', color: '#d57565' },
  fleet: { name: '远洋商会', icon: 'icon-boat', color: '#bc9337' },
  active: { name: '潮汐先锋', icon: 'icon-route', color: '#328fbb' },
} as const;
export const RARITY = { silver: '白银', gold: '黄金', prismatic: '棱彩' } as const;
export const HEXES: Hex[] = [
  { id:'deep-hooks', name:'深潜吊钩', family:'salvage', rarity:'silver', icon:'icon-salvage', description:'自动打捞产量 +35%。', effects:{raw:.35} },
  { id:'magnet', name:'磁力回收', family:'salvage', rarity:'gold', icon:'icon-scrap', description:'每次加工返还 1 废料。', effects:{recycle:1} },
  { id:'tidal-array', name:'潮汐阵列', family:'salvage', rarity:'prismatic', icon:'crane', description:'自动打捞产量 +100%。', effects:{raw:1} },
  { id:'salvage-kit', name:'海底宝库', family:'salvage', rarity:'gold', icon:'parts-crate', description:'打捞产量 +25%；本次赠送 3 台打捞机。', effects:{raw:.25}, supply:{salvage:3} },
  { id:'scrap-dealer', name:'拆船专家', family:'salvage', rarity:'silver', icon:'barge', description:'设备购入费用 -15%。', effects:{discount:.15} },
  { id:'ore-vein', name:'富矿航道', family:'salvage', rarity:'gold', icon:'buoy', description:'打捞产量 +60%，船速 -10%。', effects:{raw:.6,sailSpeed:-.1} },
  { id:'lean-recipe', name:'无损锻造', family:'industry', rarity:'gold', icon:'icon-parts', description:'加工配方从 4 废料减至 3 废料。', effects:{input:-1} },
  { id:'twin-mould', name:'双联模具', family:'industry', rarity:'prismatic', icon:'press', description:'每批加工额外产出 1 零件，加工速度 -15%。', effects:{output:1,pressSpeed:-.15} },
  { id:'flywheel', name:'飞轮增压', family:'industry', rarity:'silver', icon:'icon-auto', description:'自动加工速度 +35%。', effects:{pressSpeed:.35} },
  { id:'assembly-kit', name:'模块工厂', family:'industry', rarity:'gold', icon:'warehouse', description:'加工速度 +20%；本次赠送 2 台加工机。', effects:{pressSpeed:.2}, supply:{presses:2} },
  { id:'precision', name:'精工认证', family:'industry', rarity:'silver', icon:'icon-parts', description:'交货售价 +25%。', effects:{price:.25} },
  { id:'hot-forge', name:'红炉流水线', family:'industry', rarity:'gold', icon:'icon-press', description:'加工速度 +80%，每批多消耗 1 废料。', effects:{pressSpeed:.8,input:1} },
  { id:'trade-wind', name:'顺风帆', family:'fleet', rarity:'silver', icon:'boat-empty', description:'全部货船航速 +35%。', effects:{sailSpeed:.35} },
  { id:'cargo-hold', name:'扩容船舱', family:'fleet', rarity:'gold', icon:'crates', description:'每航次多装 2 零件，按货量结算；航速 -10%。', effects:{cargo:2,sailSpeed:-.1} },
  { id:'merchant-seal', name:'商会金印', family:'fleet', rarity:'prismatic', icon:'icon-coins', description:'所有交货售价 +80%。', effects:{price:.8} },
  { id:'convoy', name:'启航船队', family:'fleet', rarity:'gold', icon:'barge', description:'航速 +15%；本次赠送 2 艘船并雇佣船长。', effects:{sailSpeed:.15}, supply:{boats:2,captain:true} },
  { id:'charter', name:'港口特许', family:'fleet', rarity:'silver', icon:'icon-charts', description:'委托奖励 +40%。', effects:{contract:.4} },
  { id:'luxury', name:'珍品专线', family:'fleet', rarity:'gold', icon:'boat-loaded', description:'交货售价 +55%，航速 -15%。', effects:{price:.55,sailSpeed:-.15} },
  { id:'double-hook', name:'双钩吊架', family:'active', rarity:'silver', icon:'hoist', description:'每次手动打捞额外获得 2 废料。', effects:{tap:2} },
  { id:'craft-master', name:'巧手匠人', family:'active', rarity:'gold', icon:'bench', description:'手动加工速度 +100%，打捞额外获得 1 废料。', effects:{manualSpeed:1,tap:1} },
  { id:'overdrive', name:'潮能超载', family:'active', rarity:'prismatic', icon:'beacon', description:'潮能爆发期间，生产与船速额外 +100%。', effects:{surge:1} },
  { id:'bounty', name:'群岛悬赏', family:'active', rarity:'gold', icon:'icon-route', description:'委托奖励 +70%。', effects:{contract:.7} },
  { id:'seed-fund', name:'漂流基金', family:'active', rarity:'silver', icon:'icon-coins', description:'设备费用 -10%；本次获得 240 金币。', effects:{discount:.1}, supply:{coins:240} },
  { id:'harbor-heart', name:'工坊之心', family:'active', rarity:'gold', icon:'office', description:'打捞、加工、船速各 +15%。', effects:{raw:.15,pressSpeed:.15,sailSpeed:.15} },
  { id:'salvage-contract', name:'寻宝委托', family:'salvage', rarity:'silver', icon:'scrap-pile', description:'打捞 +20%，委托奖励 +20%。', effects:{raw:.2,contract:.2} },
  { id:'mass-production', name:'规模制造', family:'industry', rarity:'silver', icon:'icon-press', description:'加工速度 +20%，设备费用 -10%。', effects:{pressSpeed:.2,discount:.1} },
  { id:'island-network', name:'群岛联运', family:'fleet', rarity:'gold', icon:'icon-route', description:'航速 +25%，委托奖励 +25%。', effects:{sailSpeed:.25,contract:.25} },
  { id:'rapid-winch', name:'极速绞盘', family:'active', rarity:'silver', icon:'icon-salvage', description:'手动打捞额外 +1，手动加工速度 +50%。', effects:{tap:1,manualSpeed:.5} },
];
export const hexById = (id:string) => HEXES.find((hex)=>hex.id===id);
export function familyCounts(ids:string[]) {
  const counts:Record<Family,number>={salvage:0,industry:0,fleet:0,active:0};
  for(const id of ids){const h=hexById(id);if(h)counts[h.family]++;}
  return counts;
}
export const RESONANCE:Record<Family,[string,string]> = {
  salvage:['2 枚：打捞 +20%','4 枚：加工再返还 1 废料'],
  industry:['2 枚：加工速度 +20%','4 枚：每批额外 +1 零件'],
  fleet:['2 枚：航速 +20%','4 枚：交货售价 +35%'],
  active:['2 枚：打捞额外 +1','4 枚：委托奖励 +50%'],
};
export function modifiers(ids:string[]):Modifiers {
  const m:Modifiers={raw:1,pressSpeed:1,sailSpeed:1,price:1,discount:0,input:4,output:1,recycle:0,cargo:2,tap:1,manualSpeed:1,contract:1,surge:0};
  for(const id of ids){const h=hexById(id);if(h)for(const [key,value] of Object.entries(h.effects))m[key as keyof Modifiers]+=value!;}
  const c=familyCounts(ids);
  if(c.salvage>=2)m.raw+=.2;if(c.salvage>=4)m.recycle++;
  if(c.industry>=2)m.pressSpeed+=.2;if(c.industry>=4)m.output++;
  if(c.fleet>=2)m.sailSpeed+=.2;if(c.fleet>=4)m.price+=.35;
  if(c.active>=2)m.tap++;if(c.active>=4)m.contract+=.5;
  m.discount=Math.min(.6,m.discount);m.input=Math.max(2,m.input);m.recycle=Math.min(m.input-1,m.recycle);
  return m;
}
export function randomNext(seed:number) {
  const next=(Math.imul(seed>>>0,1664525)+1013904223)>>>0;
  return {seed:next,value:next/4294967296};
}
export function drawHexes(owned:string[],seed:number,voyages:number,exclude:string[]=[]) {
  let pool=HEXES.filter((h)=>!owned.includes(h.id) && !exclude.includes(h.id));
  if(pool.length<3)pool=HEXES.filter((h)=>!owned.includes(h.id));
  const offers:string[]=[];
  while(offers.length<3 && pool.length){
    const weights=pool.map((h)=>h.rarity==='silver'?5:h.rarity==='gold'?3:Math.min(2,.8+voyages*.15));
    const roll=randomNext(seed);seed=roll.seed;
    let value=roll.value*weights.reduce((a,b)=>a+b,0),index=weights.length-1;
    for(let i=0;i<weights.length;i++){value-=weights[i];if(value<0){index=i;break;}}
    offers.push(pool[index].id);pool.splice(index,1);
  }
  return {offers,seed};
}
