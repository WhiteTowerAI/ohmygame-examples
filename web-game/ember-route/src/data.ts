// Stable rule tags and card IDs are independent of the display language.
export type CardKind = '攻击' | '技能' | '能力' | '状态';
export type Rarity = '普通' | '精良' | '稀有';
export const KIND_LABEL:Record<CardKind,string>={'攻击':'Attack','技能':'Skill','能力':'Power','状态':'Status'};
export const RARITY_LABEL:Record<Rarity,string>={'普通':'Common','精良':'Uncommon','稀有':'Rare'};
export interface Card { uid: number; id: string; upgraded: boolean; bonus?: number; keep?: boolean }
export interface CardDef { id: string; name: string; kind: CardKind; rarity: Rarity; cost: number; upgradedCost?: number; art: number; target?: boolean; retain?: boolean; exhaust?: boolean; text: [string,string] }
const c = (id: string,name: string,kind: CardKind,rarity: Rarity,cost: number,art: number,text: [string,string],extra: Partial<CardDef> = {}): CardDef => ({id,name,kind,rarity,cost,art,text,...extra});
export const CARDS: Record<string,CardDef> = Object.fromEntries([
 c('C01','Strike','攻击','普通',1,0,['Deal 6 damage.','Deal 9 damage.'],{target:true}),
 c('C02','Guard','技能','普通',1,1,['Gain 6 Block.','Gain 9 Block.']),
 c('C03','Kindle','技能','普通',0,2,['Heat +2. Draw 1 card.','Heat +2. Draw 2 cards.']),
 c('C04','Forge Hammer','攻击','普通',1,0,['Deal 8 damage. High heat: +5 damage.','Deal 11 damage. High heat: +5 damage.'],{target:true}),
 c('C05','Spark','攻击','普通',1,2,['Deal 5 damage. Apply 3 Burn. Heat +1.','Deal 7 damage. Apply 4 Burn. Heat +1.'],{target:true}),
 c('C06','Copper Wall','技能','普通',1,1,['Gain 8 Block. Heat +1.','Gain 11 Block. Heat +1.']),
 c('C07','Condense','技能','普通',0,4,['Heat -2. Gain 3 Block.','Heat -2. Gain 5 Block.']),
 c('C08','Seek Flame','技能','普通',1,2,['Draw 3 cards. Heat +1.','Draw 4 cards. Heat +1.']),
 c('C09','Armor Spike','攻击','普通',1,0,['Deal 7 damage. Apply 1 Vulnerable.','Deal 10 damage. Apply 2 Vulnerable.'],{target:true}),
 c('C10','Steam Veil','技能','普通',1,4,['Apply 1 Weak to all enemies. Heat -1.','Apply 2 Weak to all enemies. Heat -1.']),
 c('C11','Pressurize','技能','精良',1,1,['Gain 10 Block. Heat +2. Retain.','Gain 13 Block. Heat +2. Retain.'],{retain:true}),
 c('C12','Ember Slash','攻击','精良',2,3,['Deal 18 damage. High heat: +10 damage. Heat +2.','Deal 23 damage. High heat: +10 damage. Heat +2.'],{target:true}),
 c('C13','Triple Forge','攻击','精良',1,0,['Deal 3 damage 3 times. Heat +1.','Deal 4 damage 3 times. Heat +1.'],{target:true}),
 c('C14','Tar Flask','技能','精良',1,2,['Apply 4 Burn to all enemies.','Apply 6 Burn to all enemies.']),
 c('C15','Reforge','技能','精良',1,5,['Return 1 card (not Reforge) from discard to hand. Exhaust.','Return 1 card (not Reforge) from discard to hand. Exhaust.'],{upgradedCost:0,exhaust:true}),
 c('C16','Ember Guard','能力','精良',1,1,['Venting grants 3 extra Block.','Venting grants 5 extra Block.']),
 c('C17','Cold Cycle','技能','精良',1,4,['Heat -3. If Heat falls by at least 2, draw 2 cards.','Heat -3. If Heat falls by at least 2, draw 2 cards.'],{upgradedCost:0}),
 c('C18','Preheat','能力','精良',1,2,['At turn start, Heat +1.','At turn start, Heat +1 and gain 2 Block.']),
 c('C19','Furnace Pulse','攻击','稀有',2,3,['Deal 14 damage to all enemies. Heat +2.','Deal 19 damage to all enemies. Heat +2.']),
 c('C20','Molten Gold','技能','稀有',0,2,['Heat +3. Gain 2 Energy. Exhaust.','Heat +3. Gain 3 Energy. Exhaust.'],{exhaust:true}),
 c('C21','Thermal Valve','能力','稀有',2,4,['Natural cooling: 2. First actual cooling each turn: draw 1.','Natural cooling: 2. First actual cooling each turn: draw 1.'],{upgradedCost:1}),
 c('C22','Memory Sigil','能力','稀有',1,5,['At turn end, retain 1 non-retained card.','At turn end, retain 1 non-retained card. Its next damage or Block +3.']),
 c('C23','Cold Reprisal','攻击','稀有',1,0,['Deal damage equal to Block, up to 30. Retain.','Deal damage equal to Block, up to 40. Retain.'],{target:true,retain:true}),
 c('C24','Last Flame','攻击','稀有',3,3,['Deal 36 damage. Set Heat to 6. Exhaust.','Deal 45 damage. Set Heat to 6. Exhaust.'],{target:true,exhaust:true}),
 c('S01','Cinder','状态','普通',99,3,['Unplayable.','Unplayable.']),
 c('S02','Rust','状态','普通',99,5,['Unplayable. Retain. Lose 1 HP at turn end.','Unplayable. Retain. Lose 1 HP at turn end.'],{retain:true})
].map(v=>[v.id,v]));
export const cost = (card: Card) => card.upgraded ? CARDS[card.id].upgradedCost ?? CARDS[card.id].cost : CARDS[card.id].cost;
export const cardText = (card: Card) => CARDS[card.id].text[Number(card.upgraded)];
export const cardName = (card: Card) => CARDS[card.id].name + (card.upgraded ? '⁺' : '');
export const RELICS = [
 {name:'Old Furnace Core',text:'Your first Vent each battle grants 2 extra Block.'},
 {name:'Cracked Ember',text:'The first time Heat reaches 4 each battle, gain 1 Energy.'},
 {name:'Condensing Ring',text:'At turn end, if Heat is 0, gain 4 Block before enemies act.'},
 {name:'Smith\'s Apron',text:'Gain 8 Block on the first turn of each battle.'},
 {name:'Bellows Gear',text:'The first hit of your first attack each battle deals +3 damage.'},
 {name:'Hollow Coin',text:'Gain 10 extra gold from each battle.'},
 {name:'Ash Compass',text:'Heal 3 HP when you enter an event.'},
 {name:'Insulated Gloves',text:'Your first Overheat each battle costs only 1 HP.'}
];
export interface Action { damage?:number; hits?:number; block?:number; allBlock?:number; weak?:number; burn?:number; junk?:number; heat?:number; strength?:number }
export interface EnemyDef { name:string; hp:number; art:string; cycle:Action[] }
export const ENEMIES: Record<string,EnemyDef> = {
 sentinel:{name:'Rustblade Sentinel',hp:32,art:'sentinel',cycle:[{damage:8},{block:6,damage:4}]},
 whelp:{name:'Soot Whelp',hp:24,art:'whelp',cycle:[{weak:1},{damage:6,hits:2}]},
 lantern:{name:'Rogue Lantern',hp:26,art:'lantern',cycle:[{junk:1},{damage:7}]},
 priest:{name:'Valve Priest',hp:38,art:'lantern',cycle:[{allBlock:6},{damage:9}]},
 crawler:{name:'Slag Crawler',hp:30,art:'whelp',cycle:[{damage:5,burn:1},{damage:10}]},
 guard:{name:'Copper Guard',hp:44,art:'sentinel',cycle:[{block:12},{damage:13}]},
 heavy:{name:'Twinhammer Warden',hp:86,art:'boss',cycle:[{damage:8,hits:2},{block:12,strength:2},{damage:18}]},
 stoker:{name:'Headless Stoker',hp:78,art:'boss',cycle:[{damage:6,heat:2},{junk:2},{damage:20}]},
 boss:{name:'Iron Bell Overseer',hp:150,art:'boss',cycle:[{damage:12},{block:16,junk:2},{damage:8,hits:2}]}
};
export type NodeKind = 'battle'|'elite'|'rest'|'shop'|'event'|'chest'|'boss'|'start';
export const NODE_INFO: Record<NodeKind,{name:string;icon:string;hint:string}> = {
 battle:{name:'Battle',icon:'⚒',hint:'Defeat enemies for gold and a card reward.'},
 elite:{name:'Elite',icon:'☠',hint:'A powerful enemy guards a relic.'},
 rest:{name:'Rest',icon:'♨',hint:'Heal 21 HP or upgrade a card.'},
 shop:{name:'Shop',icon:'⚖',hint:'Buy cards and relics, or remove a card.'},
 event:{name:'Event',icon:'?',hint:'Meet the people of Ash Harbor.'},
 chest:{name:'Chest',icon:'▣',hint:'Discover a new relic.'},
 boss:{name:'Iron Bell Overseer',icon:'♜',hint:'Defeat the Overseer to rekindle Ash Harbor.'},
 start:{name:'Departure',icon:'◈',hint:'An ember remains. The journey begins.'}
};
export const KEYWORDS = 'High heat: Heat 4 or above empowers marked cards. Vent: once per turn, spend 2 Heat for 4 Block. Overheat: end a turn at Heat 6 to lose 4 HP, then set Heat to 2. Burn: at turn end, take damage equal to its stacks (Block applies), then remove 1 stack. Weak: attacks deal 25% less damage. Vulnerable: take 50% more attack damage. Strength: adds damage to every attack hit. Retain: keep this card at turn end. Exhaust: remove from this battle. Powers: remain active for the battle.';
