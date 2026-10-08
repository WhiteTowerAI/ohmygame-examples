import { drawHexes, hexById, HEXES, modifiers, randomNext } from './hexes';
import { FOCUSES, focusUnlocked, ISLANDS, islandUnlocked, LEGACIES, legacyCost, MILESTONES, milestoneReady, REFIT_PRICES, REFIT_REQUIREMENTS } from './progression';
import type { Expedition, Focus, Legacy } from './progression';
export type Machine = 'salvage' | 'press' | 'boat';
export type Tech = 'currents' | 'captain' | 'night';
export type Batch = 1 | 10 | 'max';
export type Route = 'balanced' | 'express' | 'bulk' | 'premium';
export interface Ship { until: number | null; departed: number; payout: number }
export interface Settings { muted: boolean; ambience: number; effects: number; reducedMotion: boolean }
export interface Contract { id:number; kind:0|1|2; scrap:number; parts:number; coins:number }
export interface State {
  schemaVersion: 1; time: number; savedAt: number; scrap: number; parts: number; coins: number;
  rawCarry: number; salvage: number; presses: (number | null)[]; ships: Ship[];
  manualUntil: number | null; lastTap: number; captain: boolean; region: 0 | 1 | 2;
  runSales: number; chartsAvailable: number; chartsEarnedTotal: number; voyages: number;
  tech: Record<Tech, boolean>; discovered: number[]; settings: Settings;
  hexes:string[]; hexOffers:string[]; hexRerolls:number; seed:number;
  route:Route; contracts:Contract[]; contractsCompleted:number; effort:number; surgeUntil:number;
  refits:Record<Machine,number>; focus:Focus; milestones:string[]; blueprints:number;
  legacy:Record<Legacy,number>; islands:number[]; expedition:Expedition|null;
}
export interface Production { scrap: number; parts: number; coins: number; trips: number; blueprints?:number; exploration?:number }
export interface Quote { count: number; cost: number; affordable: boolean }
const EPS = 1e-7;
export const MACHINE_LIMIT = 256;
export const PRICES = { salvage: { base: 24, growth: 1.17 }, press: { base: 60, growth: 1.18 }, boat: { base: 160, growth: 1.2 } };
export const TECH_COST: Record<Tech, number> = { currents: 1, captain: 2, night: 3 };
export const REGIONS = ['漂流码头', '珊瑚航道', '灯塔港'] as const;
export const ROUTES = {
  balanced:{name:'近海',icon:'icon-route',cargo:0,duration:8,price:1,description:'标准装载，稳定交货'},
  express:{name:'快航',icon:'boat-empty',cargo:0,duration:5,price:.85,description:'5 秒往返，售价 -15%'},
  bulk:{name:'重载',icon:'barge',cargo:2,duration:10,price:1,description:'多装 2 零件，10 秒往返'},
  premium:{name:'珍品',icon:'boat-loaded',cargo:0,duration:12,price:1.7,description:'12 秒往返，售价 +70%'},
} as const;
export const CONTRACT_NAMES=['打捞补给','机械订单','群岛急件'] as const;
export function freshState(now = Date.now()): State {
  return {
    schemaVersion:1,time:0,savedAt:now,scrap:0,parts:0,coins:0,rawCarry:0,
    salvage:0,presses:[],ships:[{until:null,departed:0,payout:0}],manualUntil:null,lastTap:-1,
    captain:false,region:0,runSales:0,chartsAvailable:0,chartsEarnedTotal:0,voyages:0,
    tech:{currents:false,captain:false,night:false},discovered:[0],
    settings:{muted:false,ambience:.12,effects:.3,reducedMotion:false},
    hexes:[],hexOffers:[],hexRerolls:0,seed:(now>>>0)||123456789,
    route:'balanced',contracts:[],contractsCompleted:0,effort:0,surgeUntil:0,
    refits:{salvage:0,press:0,boat:0},focus:'balanced',milestones:[],blueprints:0,
    legacy:{engineering:0,commerce:0,supplies:0},islands:[],expedition:null,
  };
}
export const count = (s:State,kind:Machine) => kind==='salvage'?s.salvage:kind==='press'?s.presses.length:s.ships.length;
export const chartMultiplier = (s:State) => 1+s.chartsEarnedTotal*.15;
export function tide(s:State) {
  const interval=Math.floor((s.time+EPS)/60),index=interval%3;
  return {index,name:['平潮','涨潮','退潮'][index],remaining:(interval+1)*60-s.time,description:['工坊平稳运转','打捞产量 +25%','货船航速 +25%'][index]};
}
export function productionModifiers(s:State) {
  const m=modifiers(s.hexes),engineering=1.12**s.legacy.engineering,commerce=1.15**s.legacy.commerce;
  m.raw*=2**s.refits.salvage*engineering;m.pressSpeed*=2**s.refits.press*engineering;
  m.sailSpeed*=2**s.refits.boat*engineering;m.price*=commerce;m.contract*=commerce;m.tap+=s.legacy.supplies;
  if(s.focus==='salvage'){m.raw*=1.6;m.pressSpeed*=.85;}
  if(s.focus==='industry'){m.pressSpeed*=1.6;m.raw*=.85;}
  if(s.focus==='fleet'){m.price*=1.4;m.sailSpeed*=1.2;m.raw*=.85;}
  if(s.focus==='active'){m.tap+=3;m.manualSpeed*=1.8;}
  return m;
}
export function effects(s:State,base=productionModifiers(s)) {
  const m=base;
  const surge=s.surgeUntil>s.time+EPS?1.5+m.surge:1;
  const phase=tide(s).index;
  return {...m,raw:m.raw*(s.tech.currents?1.2:1)*(phase===1?1.25:1)*surge,
    pressSpeed:m.pressSpeed*surge,sailSpeed:m.sailSpeed*(phase===2?1.25:1)*surge,
    manualSpeed:m.manualSpeed*surge};
}
export const cargoSize=(s:State)=>effects(s).cargo+ROUTES[s.route].cargo;
export const tripPrice=(s:State)=>[16,24,32][s.region]*chartMultiplier(s)*effects(s).price*ROUTES[s.route].price*cargoSize(s)/2;
export const tripDuration=(s:State)=>ROUTES[s.route].duration/effects(s).sailSpeed;
export const pressDuration=(s:State)=>4/effects(s).pressSpeed;
export const manualDuration=(s:State)=>2/effects(s).manualSpeed;
export const salvageRate=(s:State)=>s.salvage*effects(s).raw;
export const offlineCap=(s:State)=>(s.tech.night?12:8)*3600;
export function steadyRates(s:State) {
  const m=effects(s),raw=salvageRate(s);
  const parts=Math.min(raw/(m.input-m.recycle),s.presses.length/pressDuration(s))*m.output;
  const shipped=s.captain?Math.min(parts,s.ships.length*cargoSize(s)/tripDuration(s)):0;
  return {scrap:raw,parts,coins:shipped*tripPrice(s)/cargoSize(s)};
}
export function bottleneck(s:State):string {
  if(!s.salvage)return '打捞';if(!s.presses.length)return '加工';if(!s.captain)return '船长';
  const m=effects(s),rates=[salvageRate(s)/(m.input-m.recycle)*m.output,s.presses.length/pressDuration(s)*m.output,s.ships.length*cargoSize(s)/tripDuration(s)];
  return ['供料','加工','运输'][rates.indexOf(Math.min(...rates))];
}
export function unitCost(s:State,kind:Machine,offset=0) {
  const owned=count(s,kind)-(kind==='boat'?1:0),{base,growth}=PRICES[kind];
  return Math.ceil(base*growth**(owned+offset)*(1-modifiers(s.hexes).discount));
}
export function quote(s:State,kind:Machine,batch:Batch):Quote {
  const limit=Math.min(batch==='max'?MACHINE_LIMIT:batch,MACHINE_LIMIT-count(s,kind));
  let cost=0,quantity=0;
  for(let i=0;i<limit;i++){
    const next=unitCost(s,kind,i);
    if(!Number.isFinite(next)||(batch==='max'&&cost+next>s.coins+EPS))break;
    cost+=next;quantity++;
  }
  return {count:quantity,cost,affordable:quantity>0&&s.coins+EPS>=cost};
}
export function buy(s:State,kind:Machine,batch:Batch):number {
  if(s.hexOffers.length)return 0;
  const q=quote(s,kind,batch);if(!q.affordable)return 0;
  s.coins=Math.max(0,s.coins-q.cost);
  if(kind==='salvage')s.salvage+=q.count;
  if(kind==='press')for(let i=0;i<q.count;i++)s.presses.push(null);
  if(kind==='boat')for(let i=0;i<q.count;i++)s.ships.push({until:null,departed:s.time,payout:0});
  startAutomatic(s);return q.count;
}
export function collect(s:State):boolean {
  if(s.hexOffers.length||s.time-s.lastTap<.25-EPS)return false;
  s.lastTap=s.time;s.scrap+=effects(s).tap;
  s.effort++;
  if(s.effort>=16){s.effort=0;s.surgeUntil=s.time+40;}
  startAutomatic(s);return true;
}
export function craft(s:State):boolean {
  const m=effects(s);
  if(s.hexOffers.length||s.manualUntil!==null||s.scrap<m.input)return false;
  s.scrap-=m.input;s.manualUntil=s.time+manualDuration(s);return true;
}
function launch(s:State,ship:Ship,m=effects(s)) {
  const cargo=m.cargo+ROUTES[s.route].cargo;
  s.parts-=cargo;ship.departed=s.time;ship.until=s.time+ROUTES[s.route].duration/m.sailSpeed;
  ship.payout=[16,24,32][s.region]*chartMultiplier(s)*m.price*ROUTES[s.route].price*cargo/2;
}
export function dispatch(s:State):boolean {
  const ship=s.ships.find((b)=>b.until===null);
  if(s.hexOffers.length||!ship||s.parts<cargoSize(s))return false;
  launch(s,ship);return true;
}
export function hireCaptain(s:State):boolean {
  if(s.hexOffers.length||s.captain||s.coins<80)return false;
  s.coins-=80;s.captain=true;startAutomatic(s);return true;
}
export function setRoute(s:State,route:Route):boolean {
  if(s.hexOffers.length||!Object.hasOwn(ROUTES,route)||s.runSales<32)return false;
  s.route=route;startAutomatic(s);return true;
}
function startAutomatic(s:State,base=productionModifiers(s)) {
  if(s.hexOffers.length)return;
  const m=effects(s,base),cargo=m.cargo+ROUTES[s.route].cargo;
  for(let i=0;i<s.presses.length&&s.scrap>=m.input;i++){
    if(s.presses[i]===null){s.scrap-=m.input;s.presses[i]=s.time+4/m.pressSpeed;}
  }
  if(s.captain)for(const ship of s.ships)if(ship.until===null&&s.parts>=cargo)launch(s,ship,m);
}
function finish(s:State,result:Production,m=productionModifiers(s)) {
  const output=()=>{s.parts+=m.output;s.scrap+=m.recycle;result.parts+=m.output;result.scrap+=m.recycle;};
  if(s.manualUntil!==null&&s.manualUntil<=s.time+EPS){output();s.manualUntil=null;}
  for(let i=0;i<s.presses.length;i++)if(s.presses[i]!==null&&s.presses[i]!<=s.time+EPS){output();s.presses[i]=null;}
  for(const ship of s.ships)if(ship.until!==null&&ship.until<=s.time+EPS){
    s.coins+=ship.payout;s.runSales+=ship.payout;result.coins+=ship.payout;result.trips++;
    ship.until=null;ship.payout=0;
  }
  const expedition=s.expedition;
  if(expedition&&expedition.until<=s.time+EPS){
    s.scrap+=expedition.scrap;s.parts+=expedition.parts;s.coins+=expedition.coins;s.blueprints+=expedition.blueprints;
    result.scrap+=expedition.scrap;result.parts+=expedition.parts;result.coins+=expedition.coins;
    result.blueprints=(result.blueprints??0)+expedition.blueprints;result.exploration=expedition.island;
    if(!s.islands.includes(expedition.island))s.islands.push(expedition.island);
    s.expedition=null;
  }
}
function phase(s:State):string {
  const remaining=(t:number|null)=>t===null?'-':(t-s.time).toFixed(5);
  return [tide(s).index,s.expedition?'exploring':s.islands.join(','),s.rawCarry.toFixed(5),remaining(s.manualUntil),...s.presses.map(remaining),
    ...s.ships.map((ship)=>`${remaining(ship.until)}:${ship.payout.toFixed(4)}`)].join('|');
}
// A conservative shortcut: existing inventories must cover EVERY new recipe and
// departure in the interval, even without counting any production during it.
// This guarantees no starvation can happen between the batched completions.
function advanceStocked(s:State,result:Production,target:number,m:ReturnType<typeof effects>):boolean {
  const dt=target-s.time;
  if(dt<1||s.manualUntil!==null||s.expedition||s.presses.some(t=>t===null)||s.ships.some(b=>s.captain?b.until===null:b.until!==null))return false;
  const pressCycle=4/m.pressSpeed,shipCycle=ROUTES[s.route].duration/m.sailSpeed,cargo=m.cargo+ROUTES[s.route].cargo;
  const completions=(until:number,period:number)=>until>target+EPS?0:1+Math.floor((target-until+EPS)/period);
  const presses=s.presses.map(t=>completions(t!,pressCycle));
  const ships=s.ships.map(b=>b.until===null?0:completions(b.until,shipCycle));
  const crafted=presses.reduce((a,b)=>a+b,0),trips=ships.reduce((a,b)=>a+b,0);
  if(s.scrap<m.input*crafted||s.parts<cargo*trips)return false;
  const raw=s.rawCarry+dt*s.salvage*m.raw,generated=Math.floor(raw+EPS);
  s.rawCarry=Math.max(0,raw-generated);
  s.scrap+=generated+(m.recycle-m.input)*crafted;s.parts+=m.output*crafted-cargo*trips;
  result.scrap+=generated+m.recycle*crafted;result.parts+=m.output*crafted;result.trips+=trips;
  for(let i=0;i<presses.length;i++)if(presses[i])s.presses[i]=s.presses[i]!+presses[i]*pressCycle;
  const payout=[16,24,32][s.region]*chartMultiplier(s)*m.price*ROUTES[s.route].price*cargo/2;
  let income=0;
  for(let i=0;i<ships.length;i++)if(ships[i]){
    const b=s.ships[i],completed=ships[i];income+=b.payout+(completed-1)*payout;
    b.departed=b.until!+(completed-1)*shipCycle;b.until=b.until!+completed*shipCycle;b.payout=payout;
  }
  s.coins+=income;s.runSales+=income;result.coins+=income;s.time=target;return true;
}
// Stocked intervals and matching production/tide phases can be batched; all other
// intervals use the same exact event order online and offline.
export function advance(s:State,seconds:number):Production {
  const result:Production={scrap:0,parts:0,coins:0,trips:0};
  if(!Number.isFinite(seconds)||seconds<=0||s.hexOffers.length)return result;
  const end=s.time+Math.min(seconds,12*3600),base=productionModifiers(s);
  let checkpoint=s.time+180;
  const phases=new Map<string,{time:number;scrap:number;parts:number;coins:number;result:Production}>();
  finish(s,result,base);startAutomatic(s,base);
  while(s.time<end-EPS){
    const tideBoundary=(Math.floor((s.time+EPS)/60)+1)*60;
    let next=Math.min(end,checkpoint,tideBoundary);
    if(s.surgeUntil>s.time+EPS)next=Math.min(next,s.surgeUntil);
    if(s.expedition)next=Math.min(next,s.expedition.until);
    const m=effects(s,base),rate=s.salvage*m.raw,input=m.input;
    // Leave a tiny boundary event to apply the NEW tide/surge parameters to
    // jobs launched at that exact instant; old in-flight jobs stay locked.
    const stockedEnd=Math.min(next,s.time+15,tideBoundary-1e-6,s.surgeUntil>s.time+EPS?s.surgeUntil-1e-6:Infinity);
    if(!advanceStocked(s,result,stockedEnd,m)){
      if(s.manualUntil!==null)next=Math.min(next,s.manualUntil);
      for(const t of s.presses)if(t!==null)next=Math.min(next,t);
      for(const ship of s.ships)if(ship.until!==null)next=Math.min(next,ship.until);
      if(rate>0&&s.scrap<input&&s.presses.some((t)=>t===null))next=Math.min(next,s.time+(input-s.scrap-s.rawCarry)/rate);
      const dt=Math.max(0,next-s.time),accumulated=s.rawCarry+dt*rate,generated=Math.floor(accumulated+EPS);
      s.rawCarry=Math.max(0,accumulated-generated);s.scrap+=generated;result.scrap+=generated;s.time=next;
      finish(s,result,base);startAutomatic(s,base);
    }
    if(s.time>=checkpoint-EPS){
      const signature=phase(s),previous=phases.get(signature);
      if(previous&&s.expedition===null&&s.manualUntil===null&&s.surgeUntil<=previous.time&&s.scrap>=previous.scrap&&s.parts>=previous.parts){
        const period=s.time-previous.time,cycles=Math.floor((end-s.time+EPS)/period);
        if(cycles>0){
          const skipped=cycles*period;
          s.scrap+=(s.scrap-previous.scrap)*cycles;s.parts+=(s.parts-previous.parts)*cycles;
          const income=(s.coins-previous.coins)*cycles;s.coins+=income;s.runSales+=income;
          for(const key of ['scrap','parts','coins','trips'] as const)result[key]+=(result[key]-previous.result[key])*cycles;
          s.time+=skipped;s.presses=s.presses.map((t)=>t===null?null:t+skipped);
          for(const ship of s.ships)if(ship.until!==null){ship.until+=skipped;ship.departed+=skipped;}
        }
      }
      phases.set(phase(s),{time:s.time,scrap:s.scrap,parts:s.parts,coins:s.coins,result:{...result}});checkpoint=s.time+180;
    }
  }
  return result;
}
export function ensureContracts(s:State) {
  if(s.runSales<32||s.contracts.length||s.hexOffers.length)return;
  const roll=randomNext(s.seed);s.seed=roll.seed;
  const size=(s.region+1)*(1+s.contractsCompleted%4),variation=1+Math.floor(roll.value*3);
  s.contracts=[
    {id:s.contractsCompleted*3,kind:0,scrap:(16+variation*8)*size,parts:2*size,coins:(64+variation*16)*size},
    {id:s.contractsCompleted*3+1,kind:1,scrap:0,parts:(4+variation*2)*size,coins:(48+variation*24)*size},
    {id:s.contractsCompleted*3+2,kind:2,scrap:12*size,parts:(3+variation)*size,coins:(64+variation*20)*size},
  ];
}
export const contractReward=(s:State,c:Contract)=>c.coins*chartMultiplier(s)*effects(s).contract;
export function deliverContract(s:State,id:number):number {
  const c=s.contracts.find((c)=>c.id===id);
  if(s.hexOffers.length||!c||s.scrap<c.scrap||s.parts<c.parts)return 0;
  s.scrap-=c.scrap;s.parts-=c.parts;
  const reward=contractReward(s,c);s.coins+=reward;s.runSales+=reward;s.contractsCompleted++;
  s.effort=Math.min(15,s.effort+4);s.contracts=[];ensureContracts(s);startAutomatic(s);return reward;
}
export function expand(s:State):boolean {
  const threshold=s.region===0?1200:12000,cost=s.region===0?800:6000;
  if(s.hexOffers.length||s.region>=2||s.runSales<threshold||s.coins<cost)return false;
  s.coins-=cost;s.region=(s.region+1) as 1|2;
  if(!s.discovered.includes(s.region))s.discovered.push(s.region);
  s.contracts=[];ensureContracts(s);return true;
}
export const voyageReward=(s:State)=>s.region===2&&s.runSales>=20000?Math.floor(Math.sqrt(s.runSales/20000)):0;
export function voyage(s:State):State|null {
  const reward=voyageReward(s);if(!reward||s.hexOffers.length)return null;
  const next=freshState();
  next.chartsAvailable=s.chartsAvailable+reward;next.chartsEarnedTotal=s.chartsEarnedTotal+reward;
  next.voyages=s.voyages+1;next.tech={...s.tech};next.discovered=[...s.discovered];next.settings={...s.settings};
  next.milestones=[...s.milestones];next.blueprints=s.blueprints;next.legacy={...s.legacy};next.islands=[...s.islands];
  next.salvage=1;next.coins=24+s.legacy.supplies*60;next.scrap=s.legacy.supplies*16;next.captain=s.tech.captain;next.hexes=[...s.hexes];next.seed=s.seed;
  const drawn=drawHexes(next.hexes,next.seed,next.voyages);next.hexOffers=drawn.offers;next.seed=drawn.seed;next.hexRerolls=drawn.offers.length?1:0;
  return next;
}
export function rerollHexes(s:State):boolean {
  if(!s.hexOffers.length||!s.hexRerolls)return false;
  const drawn=drawHexes(s.hexes,s.seed,s.voyages,s.hexOffers);
  s.hexOffers=drawn.offers;s.seed=drawn.seed;s.hexRerolls--;return true;
}
export function chooseHex(s:State,id:string):boolean {
  const h=hexById(id);if(!h||!s.hexOffers.includes(id)||s.hexes.includes(id))return false;
  s.hexes.push(id);s.hexOffers=[];s.hexRerolls=0;
  if(h.supply){
    s.coins+=h.supply.coins??0;s.salvage=Math.min(MACHINE_LIMIT,s.salvage+(h.supply.salvage??0));
    for(let i=0;i<(h.supply.presses??0)&&s.presses.length<MACHINE_LIMIT;i++)s.presses.push(null);
    for(let i=0;i<(h.supply.boats??0)&&s.ships.length<MACHINE_LIMIT;i++)s.ships.push({until:null,departed:s.time,payout:0});
    if(h.supply.captain)s.captain=true;
  }
  startAutomatic(s);return true;
}
export function research(s:State,tech:Tech):boolean {
  const cost=TECH_COST[tech];if(s.hexOffers.length||s.tech[tech]||s.chartsAvailable<cost)return false;
  s.chartsAvailable-=cost;s.tech[tech]=true;return true;
}
export function refitQuote(s:State,kind:Machine) {
  const level=s.refits[kind],requirement=REFIT_REQUIREMENTS[level]??Infinity,cost=REFIT_PRICES[kind][level]??0;
  return {level,requirement,cost,unlocked:level<3&&count(s,kind)>=requirement,affordable:level<3&&count(s,kind)>=requirement&&s.coins>=cost};
}
export function refit(s:State,kind:Machine):boolean {
  const q=refitQuote(s,kind);if(s.hexOffers.length||!q.affordable)return false;
  s.coins-=q.cost;s.refits[kind]++;startAutomatic(s);return true;
}
export function setFocus(s:State,focus:Focus):boolean {
  if(s.hexOffers.length||!Object.hasOwn(FOCUSES,focus)||!focusUnlocked(s))return false;
  s.focus=focus;startAutomatic(s);return true;
}
export function claimMilestone(s:State,id:string):boolean {
  if(s.hexOffers.length||!milestoneReady(s,id))return false;
  const m=MILESTONES.find(m=>m.id===id)!;s.milestones.push(id);
  s.coins+=m.coins??0;s.scrap+=m.scrap??0;s.blueprints+=m.blueprints??0;startAutomatic(s);return true;
}
export function learnLegacy(s:State,key:Legacy):boolean {
  if(s.hexOffers.length||!Object.hasOwn(LEGACIES,key)||s.legacy[key]>=5||s.blueprints<legacyCost(s.legacy[key]))return false;
  s.blueprints-=legacyCost(s.legacy[key]);s.legacy[key]++;startAutomatic(s);return true;
}
export function explorationQuote(s:State,index:number) {
  const island=ISLANDS[index];if(!island)return null;
  return {scrap:island.scrap,parts:island.parts,duration:Math.max(island.seconds/3,island.seconds/effects(s).sailSpeed),
    coins:island.coins*chartMultiplier(s)*effects(s).price,blueprints:island.prints+(s.islands.includes(index)?0:island.first),
    unlocked:islandUnlocked(s,index),affordable:islandUnlocked(s,index)&&!s.expedition&&s.scrap>=island.scrap&&s.parts>=island.parts};
}
export function explore(s:State,index:number):boolean {
  const q=explorationQuote(s,index);if(s.hexOffers.length||!q?.affordable)return false;
  const island=ISLANDS[index];s.scrap-=q.scrap;s.parts-=q.parts;
  s.expedition={island:index,departed:s.time,until:s.time+q.duration,scrap:island.lootScrap,parts:island.lootParts,coins:q.coins,blueprints:q.blueprints};
  return true;
}
const number=(v:unknown,max=1e15):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const integer=(v:unknown,max=1e15):v is number=>number(v,max)&&Number.isInteger(v);
export function parseState(raw:string):State {
  if(raw.length>300000)throw new Error('存档文件过大');
  const v=JSON.parse(raw);if(!v||v.schemaVersion!==1)throw new Error('存档版本不兼容');
  for(const key of ['time','savedAt','coins','runSales'])if(!number(v[key]))throw new Error(`存档数值无效：${key}`);
  for(const key of ['scrap','parts','chartsAvailable','chartsEarnedTotal','voyages'])if(!integer(v[key]))throw new Error(`存档数量无效：${key}`);
  if(v.chartsAvailable>v.chartsEarnedTotal||!number(v.rawCarry,1)||v.rawCarry>=1||!integer(v.salvage,MACHINE_LIMIT))throw new Error('存档资源无效');
  if(typeof v.captain!=='boolean'||!integer(v.region,2)||typeof v.lastTap!=='number'||!Number.isFinite(v.lastTap)||v.lastTap< -1||v.lastTap>v.time+EPS)throw new Error('存档生产状态无效');
  const validEnd=(t:unknown,duration:number)=>t===null||(number(t)&&t>=v.time-EPS&&t<=v.time+duration+EPS);
  if(!validEnd(v.manualUntil,10)||!Array.isArray(v.presses)||v.presses.length>MACHINE_LIMIT||!v.presses.every((t:unknown)=>validEnd(t,30)))throw new Error('存档加工状态无效');
  if(!Array.isArray(v.ships)||v.ships.length<1||v.ships.length>MACHINE_LIMIT||!v.ships.every((ship:Ship)=>ship&&validEnd(ship.until,60)&&number(ship.departed)&&ship.departed<=v.time+EPS&&number(ship.payout)&&(ship.until===null?ship.payout===0:ship.until>ship.departed&&ship.until-ship.departed<=60&&ship.payout>0)))throw new Error('存档航行状态无效');
  if(!v.tech||!(['currents','captain','night'] as const).every((key)=>typeof v.tech[key]==='boolean'))throw new Error('存档科技无效');
  if(!Array.isArray(v.discovered)||v.discovered.length>3||!v.discovered.every((r:unknown)=>integer(r,2))||!v.discovered.includes(0)||!v.discovered.includes(v.region))throw new Error('存档图鉴无效');
  const p=v.settings;if(!p||typeof p.muted!=='boolean'||typeof p.reducedMotion!=='boolean'||!number(p.ambience,1)||!number(p.effects,1))throw new Error('存档设置无效');
  const hexes=v.hexes??[],offers=v.hexOffers??[],rerolls=v.hexRerolls??0,seed=v.seed??((v.savedAt>>>0)||123456789);
  if(![hexes,offers].every((ids)=>Array.isArray(ids)&&ids.every((id:unknown)=>typeof id==='string'&&!!hexById(id))&&new Set(ids).size===ids.length)||hexes.length>HEXES.length||offers.length>3||offers.some((id:string)=>hexes.includes(id))||!integer(rerolls,1)||!integer(seed,4294967295))throw new Error('存档海克斯状态无效');
  if(offers.length&&(!v.voyages||hexes.length>=v.voyages)||hexes.length>v.voyages)throw new Error('存档海克斯进度无效');
  const route=v.route??'balanced',contracts=v.contracts??[],completed=v.contractsCompleted??0,effort=v.effort??0,surge=v.surgeUntil??0;
  if(typeof route!=='string'||!Object.hasOwn(ROUTES,route)||!integer(completed,1e9)||!integer(effort,15)||!number(surge)||surge>v.time+3600)throw new Error('存档经营状态无效');
  if(!Array.isArray(contracts)||contracts.length>3||new Set(contracts.map((c:Contract)=>c?.id)).size!==contracts.length||!contracts.every((c:Contract)=>c&&integer(c.id,3e9)&&integer(c.kind,2)&&integer(c.scrap)&&integer(c.parts)&&number(c.coins)&&c.coins>0&&(c.parts>0||c.scrap>0)))throw new Error('存档委托无效');
  const refits=v.refits??{salvage:0,press:0,boat:0},focus=v.focus??'balanced',milestones=v.milestones??[],blueprints=v.blueprints??0;
  const legacy=v.legacy??{engineering:0,commerce:0,supplies:0},islands=v.islands??[],expedition=v.expedition??null;
  if(!refits||!(['salvage','press','boat'] as const).every(k=>integer(refits[k],3)&&(!refits[k]||({salvage:v.salvage,press:v.presses.length,boat:v.ships.length}[k]>=REFIT_REQUIREMENTS[refits[k]-1])))||typeof focus!=='string'||!Object.hasOwn(FOCUSES,focus))throw new Error('存档改造或专精无效');
  if(!Array.isArray(milestones)||milestones.length>MILESTONES.length||new Set(milestones).size!==milestones.length||!milestones.every((id:unknown)=>typeof id==='string'&&MILESTONES.some(m=>m.id===id))||!integer(blueprints))throw new Error('存档航程奖励无效');
  if(!legacy||!(['engineering','commerce','supplies'] as const).every(k=>integer(legacy[k],5))||!Array.isArray(islands)||islands.length>ISLANDS.length||new Set(islands).size!==islands.length||!islands.every((i:unknown)=>integer(i,ISLANDS.length-1)))throw new Error('存档传承或群岛无效');
  if(expedition){
    const island=ISLANDS[expedition.island as number];
    if(!island||!integer(expedition.island,ISLANDS.length-1)||!number(expedition.departed)||expedition.departed>v.time+EPS||!number(expedition.until)||expedition.until<v.time-EPS||expedition.until<=expedition.departed||expedition.until-expedition.departed>island.seconds+EPS||expedition.until-expedition.departed<island.seconds/3-EPS||expedition.scrap!==island.lootScrap||expedition.parts!==island.lootParts||!number(expedition.coins)||expedition.coins<=0||expedition.blueprints!==island.prints+(islands.includes(expedition.island)?0:island.first)||v.region<island.region||v.runSales<island.sales)throw new Error('存档探索任务无效');
  }
  return {
    schemaVersion:1,time:v.time,savedAt:v.savedAt,scrap:v.scrap,parts:v.parts,coins:v.coins,
    rawCarry:v.rawCarry,salvage:v.salvage,presses:[...v.presses],ships:v.ships.map((ship:Ship)=>({...ship})),
    manualUntil:v.manualUntil,lastTap:v.lastTap,captain:v.captain,region:v.region,runSales:v.runSales,
    chartsAvailable:v.chartsAvailable,chartsEarnedTotal:v.chartsEarnedTotal,voyages:v.voyages,
    tech:{currents:v.tech.currents,captain:v.tech.captain,night:v.tech.night},discovered:[...new Set<number>(v.discovered)],
    settings:{muted:p.muted,reducedMotion:p.reducedMotion,ambience:p.ambience,effects:p.effects},
    refits:{salvage:refits.salvage,press:refits.press,boat:refits.boat},focus:focus as Focus,milestones:[...milestones],blueprints,
    legacy:{engineering:legacy.engineering,commerce:legacy.commerce,supplies:legacy.supplies},islands:[...islands],expedition:expedition?{...expedition}:null,
    hexes:[...hexes],hexOffers:[...offers],hexRerolls:rerolls,seed,route:route as Route,
    contracts:contracts.map((c:Contract)=>({...c})),contractsCompleted:completed,effort,surgeUntil:surge,
  };
}
export function settleOffline(s:State,now:number):Production&{seconds:number;truncated:boolean} {
  const elapsed=Math.max(0,(now-s.savedAt)/1000),seconds=Math.min(elapsed,offlineCap(s));
  const result=advance(s,seconds);s.savedAt=now;return {...result,seconds,truncated:elapsed>seconds};
}
